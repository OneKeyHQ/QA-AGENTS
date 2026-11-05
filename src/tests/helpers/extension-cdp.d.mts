import type { Browser, Page } from 'playwright-core';

/** Selected extension ID, using ONEKEY_EXT_ID when configured. */
export function getExtensionId(): string;

/** Resolve the configured or installed extension directory; throws when unavailable. */
export function getExtensionPath(): string;

/** Return a running Chrome debugging port, or null when none is detected. */
export function detectChromeCdpPort(excludePorts?: number[]): number | null;

/** Ensure the extension browser is available; may launch Chrome. */
export function ensureExtensionRunning(): Promise<void>;

/** Connect to the extension browser and return its page. */
export function connectExtensionCDP(): Promise<{ browser: Browser; page: Page }>;
