/**
 * 自定义中文报告器
 * 输出中文格式的测试报告到控制台
 */
class ChineseReporter {
  constructor() {
    this.startTime = 0;
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
    this.flaky = 0;
    this.testResults = [];
  }

  onBegin(config, suite) {
    this.startTime = Date.now();
    const totalTests = suite.allTests().length;
    
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    🧪 自动化测试执行报告                      ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  📅 执行时间: ${new Date().toLocaleString('zh-CN')}`.padEnd(65) + '║');
    console.log(`║  📊 测试用例: ${totalTests} 个`.padEnd(65) + '║');
    console.log(`║  🌐 浏览器: ${config.projects[0]?.name || 'Chrome'}`.padEnd(65) + '║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n📋 测试执行中...\n');
  }

  onTestBegin(test) {
    const title = this.getTestTitle(test);
    process.stdout.write(`  ⏳ ${title} ... `);
  }

  onTestEnd(test, result) {
    const title = this.getTestTitle(test);
    const duration = result.duration;
    const durationStr = this.formatDuration(duration);
    
    let statusIcon;
    let statusText;
    
    switch (result.status) {
      case 'passed':
        if (result.retry > 0) {
          this.flaky++;
          statusIcon = '⚡';
          statusText = `重试后通过 (${durationStr})`;
        } else {
          this.passed++;
          statusIcon = '✅';
          statusText = `通过 (${durationStr})`;
        }
        break;
      case 'failed':
        this.failed++;
        statusIcon = '❌';
        statusText = `失败 (${durationStr})`;
        break;
      case 'skipped':
        this.skipped++;
        statusIcon = '⏭️';
        statusText = '跳过';
        break;
      case 'timedOut':
        this.failed++;
        statusIcon = '⏰';
        statusText = `超时 (${durationStr})`;
        break;
      default:
        statusIcon = '❓';
        statusText = result.status;
    }
    
    console.log(`${statusIcon} ${statusText}`);
    
    this.testResults.push({
      title,
      status: result.status,
      duration,
      error: result.error?.message
    });
    
    // 如果失败，显示错误信息
    if (result.status === 'failed' && result.error) {
      console.log(`     💥 错误: ${result.error.message?.split('\n')[0]}`);
    }
  }

  onEnd(result) {
    const totalTime = Date.now() - this.startTime;
    const total = this.passed + this.failed + this.skipped + this.flaky;
    
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                       📊 测试结果汇总                         ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    
    // 统计结果
    console.log(`║  ✅ 通过: ${this.passed} 个`.padEnd(65) + '║');
    if (this.flaky > 0) {
      console.log(`║  ⚡ 重试后通过: ${this.flaky} 个`.padEnd(65) + '║');
    }
    if (this.failed > 0) {
      console.log(`║  ❌ 失败: ${this.failed} 个`.padEnd(65) + '║');
    }
    if (this.skipped > 0) {
      console.log(`║  ⏭️  跳过: ${this.skipped} 个`.padEnd(65) + '║');
    }
    
    console.log('╠══════════════════════════════════════════════════════════════╣');
    
    // 通过率
    const passRate = total > 0 ? Math.round(((this.passed + this.flaky) / total) * 100) : 0;
    const passRateBar = this.generateProgressBar(passRate);
    console.log(`║  📈 通过率: ${passRate}% ${passRateBar}`.padEnd(65) + '║');
    console.log(`║  ⏱️  总耗时: ${this.formatDuration(totalTime)}`.padEnd(65) + '║');
    
    console.log('╠══════════════════════════════════════════════════════════════╣');
    
    // 最终状态
    let finalStatus;
    if (result.status === 'passed') {
      finalStatus = '║  🎉 测试结果: 全部通过！                                      ║';
    } else if (result.status === 'failed') {
      finalStatus = '║  ⚠️  测试结果: 存在失败用例                                   ║';
    } else {
      finalStatus = `║  ℹ️  测试结果: ${result.status}`.padEnd(65) + '║';
    }
    console.log(finalStatus);
    
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    // 如果有失败，显示失败详情
    if (this.failed > 0) {
      console.log('❌ 失败用例详情:\n');
      this.testResults
        .filter(t => t.status === 'failed')
        .forEach((t, i) => {
          console.log(`  ${i + 1}. ${t.title}`);
          if (t.error) {
            console.log(`     错误: ${t.error.split('\n')[0]}`);
          }
          console.log('');
        });
    }
  }

  getTestTitle(test) {
    // 获取完整的测试标题（包含 describe 层级）
    const titles = [];
    let parent = test.parent;
    while (parent) {
      if (parent.title) {
        titles.unshift(parent.title);
      }
      parent = parent.parent || undefined;
    }
    titles.push(test.title);
    
    // 返回最后两级标题
    if (titles.length > 2) {
      return titles.slice(-2).join(' > ');
    }
    return titles.join(' > ');
  }

  formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}毫秒`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}秒`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.round((ms % 60000) / 1000);
      return `${minutes}分${seconds}秒`;
    }
  }

  generateProgressBar(percent) {
    const filled = Math.round(percent / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
}

module.exports = ChineseReporter;
