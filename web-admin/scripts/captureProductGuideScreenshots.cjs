const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.GUIDE_BASE_URL || 'http://127.0.0.1:4173/#';
const outputDir = path.resolve(__dirname, '../docs/images/product-cloud/verified');
const profileDir = path.resolve(__dirname, '../.guide-product-profile');

const routes = [
  ['01-tong-quan', '/dashboard'],
  ['02-du-an-tat-ca', '/projects?status=all'],
  ['03-du-an-dang-trien-khai', '/projects?status=active'],
  ['04-du-an-hoan-thanh', '/projects?status=completed'],
  ['05-cong-viec-tong-quan', '/task-assignment?tab=overview'],
  ['06-cong-viec-du-an', '/task-assignment?tab=project_tasks'],
  ['07-cong-viec-phat-sinh', '/task-assignment?tab=direct'],
  ['08-viec-cua-toi', '/my-tasks'],
  ['09-ke-hoach', '/work-plan'],
  ['10-ho-so', '/document-tracking'],
  ['11-kho-tong-quan', '/materials?tab=overview'],
  ['12-kho-ton', '/materials?tab=stock'],
  ['13-kho-nhap', '/materials?tab=import'],
  ['14-kho-xuat', '/materials?tab=export'],
  ['15-cong-luong-tong-quan', '/attendance?tab=overview'],
  ['16-cham-cong', '/attendance?tab=attendance'],
  ['17-xin-nghi', '/attendance?tab=leave'],
  ['18-bu-cong', '/attendance?tab=adjustment'],
  ['19-nhan-su', '/personnel'],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function signedIn(page) {
  return !(await page.evaluate(() => location.hash.includes('/login')));
}

async function closeReadOnlyOverlays(page) {
  await page.evaluate(() => {
    const labels = ['Đóng', 'Hủy', 'Ở lại'];
    for (const label of labels) {
      const button = Array.from(document.querySelectorAll('button')).find((item) =>
        (item.textContent || '').trim() === label,
      );
      if (button) button.click();
    }
  });
}

async function navigateUsingMenu(page, route) {
  const clicked = await page.evaluate((targetRoute) => {
    const target = Array.from(document.querySelectorAll('a')).find((link) => {
      const hash = new URL(link.href).hash.replace(/^#/, '');
      return hash === targetRoute;
    });
    if (!target) return false;
    target.click();
    return true;
  }, route);
  if (!clicked) throw new Error(`Không tìm thấy liên kết menu cho ${route}`);
  await sleep(2200);
  const currentRoute = await page.evaluate(() => location.hash.replace(/^#/, ''));
  if (currentRoute !== route) {
    throw new Error(`Điều hướng không khớp: cần ${route}, đang ở ${currentRoute}`);
  }
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browserUrl = process.env.GUIDE_BROWSER_URL;
  const attached = Boolean(browserUrl);
  const browser = attached
    ? await puppeteer.connect({ browserURL: browserUrl })
    : await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        userDataDir: profileDir,
        defaultViewport: { width: 1440, height: 900 },
        args: ['--no-first-run', '--no-default-browser-check'],
      });
  const pages = await browser.pages();
  const page = pages.find((item) => item.url().startsWith(baseUrl)) || await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  if (!attached) {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    console.log('Đăng nhập thủ công trong cửa sổ Chrome vừa mở. Script sẽ tự chụp sau khi vào trang chính.');
    const deadline = Date.now() + 5 * 60 * 1000;
    while (!(await signedIn(page))) {
      if (Date.now() > deadline) throw new Error('Hết thời gian chờ đăng nhập thủ công.');
      await sleep(1000);
    }
  }

  for (const [name, route] of routes) {
    await navigateUsingMenu(page, route);
    await closeReadOnlyOverlays(page);
    await sleep(300);
    await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true });
    console.log(`Đã chụp ${name}.png`);
  }
  if (attached) await browser.disconnect();
  else await browser.close();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
