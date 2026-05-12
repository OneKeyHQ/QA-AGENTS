let { exec } = require('child_process');
let gulp = require('gulp');
let boilerplate = require('@appium/gulp-plugins').boilerplate.use(gulp);

boilerplate({
  build: '@node-e2e/touchdriver',
  files: ['index.js', 'lib/**/*.js', '!gulpfile.js'],
});

gulp.task('install-appium-driver', (done) => {
  let command = `appium driver install --source=local ${process.cwd()}`;

  exec(command, (err, stdout, stderr) => {
    if (err) {
      console.error(`执行错误: ${err}`);
      return;
    }

    console.log(`标准输出: ${stdout}`);
    console.error(`标准错误: ${stderr}`);
    done();
  });
});
