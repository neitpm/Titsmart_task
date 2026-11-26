const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173/#';
const OUT = path.resolve(__dirname, '../docs/images');

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
  });
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT, '01-dang-nhap.png'), fullPage: false });

  const usernameInput = await page.$('input[placeholder="Nhập tên đăng nhập"]');
  const passwordInput = await page.$('input[placeholder="Nhập mật khẩu"]');
  if (usernameInput && passwordInput) {
    await usernameInput.click({ clickCount: 3 });
    await usernameInput.type('gt');
    await passwordInput.click({ clickCount: 3 });
    await passwordInput.type('123456');

    const loginButton = await page.$('button[type="submit"]');
    if (loginButton) {
      await loginButton.click();
      await new Promise(r => setTimeout(r, 4500));
    }
  }

  const isStillLogin = (await page.evaluate(() => window.location.hash)).includes('/login');
  if (isStillLogin) {
    const directorUser = {
      id: 'gt-001', username: 'gt', name: 'Giám đốc', role: 'giám đốc',
      title: 'Giám đốc', email: 'gt@titsmart.vn', phone: '',
      permissions: ['VIEW_PROJECTS','CREATE_PROJECTS','EDIT_PROJECTS','DELETE_PROJECTS','VIEW_TASKS','IMPORT_TASKS','EDIT_TASKS','ASSIGN_TASKS','UPDATE_TASK_PROGRESS','APPROVE_TASKS','VIEW_MATERIALS','IMPORT_MATERIALS','EDIT_MATERIALS','UPDATE_MATERIAL_STATUS','MANAGE_INVENTORY','VIEW_FINANCE','EDIT_PRICES','VIEW_PAYMENTS','EDIT_PAYMENTS','VIEW_EXPENSES','EDIT_EXPENSES','MANAGE_PAYROLL','VIEW_USERS','EDIT_USERS','MANAGE_USERS','MANAGE_PERMISSIONS','VIEW_DOCUMENTS','CREATE_DOCUMENTS','EDIT_DOCUMENTS','DELETE_DOCUMENTS','MANAGE_DOCUMENTS','EXPORT_DATA','VIEW_ACTIVITY_LOG','VIEW_FIELD_LOGS','MANAGE_FIELD_LOGS','VIEW_PROJECT_DIAGRAM','MANAGE_PROJECT_DIAGRAM']
    };
    await page.evaluate((user) => {
      localStorage.setItem('titsmart_auth_session', JSON.stringify(user));
    }, directorUser);
    await page.goto(`${BASE}/projects`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3500));

    const projectCode = await page.evaluate(() => {
      const href = Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.getAttribute('href') || '')
        .find(value => value.includes('/projects/') && !value.endsWith('/projects'));
      if (!href) return null;

      const match = href.match(/\/projects\/([^/]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    }) || 'TRAM-BIEN-AP-110KV-PHUOC-DONG-6';

    const routes = [
      ['02-tong-quan-he-thong', '/dashboard'],
      ['03-danh-sach-du-an', '/projects'],
      ['04-cong-viec-du-an', '/task-assignment?tab=project_tasks'],
      ['05-cong-viec-phat-sinh', '/task-assignment?tab=direct'],
      ['06-viec-cua-toi', '/my-tasks'],
      ['07-ke-hoach-cong-viec', '/work-plan'],
      ['08-quan-ly-ho-so', '/document-tracking'],
      ['09-tong-kho', '/materials?tab=overview'],
      ['10-nhan-su', '/personnel'],
      ['11-cham-cong', '/attendance?tab=attendance'],
      ['12-xin-nghi', '/attendance?tab=leave'],
      ['13-bu-cong', '/attendance?tab=adjustment'],
      ['14-nhat-ky-hoat-dong', '/activity-log'],
      ['15-cai-dat', '/settings'],
      ['16-tai-khoan', '/account'],
      ['17-du-an-tong-quan', `/projects/${encodeURIComponent(projectCode)}/overview`],
      ['18-du-an-ke-hoach', `/projects/${encodeURIComponent(projectCode)}/plan`],
      ['19-du-an-tien-do', `/projects/${encodeURIComponent(projectCode)}/tasks`],
      ['20-du-an-dat-hang', `/projects/${encodeURIComponent(projectCode)}/cost-plan?tab=TECH`],
      ['21-du-an-chung-tu', `/projects/${encodeURIComponent(projectCode)}/cost-plan?tab=DOCS`],
      ['22-du-an-thanh-toan', `/projects/${encodeURIComponent(projectCode)}/cost-plan?tab=FINANCE`],
      ['23-du-an-chi-phi', `/projects/${encodeURIComponent(projectCode)}/cost-plan?tab=EXPENSE`],
      ['24-du-an-yc-thanh-toan', `/projects/${encodeURIComponent(projectCode)}/cost-plan?tab=PAYMENT_REQUEST`],
      ['25-du-an-ho-so', `/projects/${encodeURIComponent(projectCode)}/documents`],
      ['26-du-an-thu-vien', `/projects/${encodeURIComponent(projectCode)}/diagram`],
      ['27-du-an-kho', `/projects/${encodeURIComponent(projectCode)}/inventory?tab=overview`],
      ['28-du-an-hien-truong', `/projects/${encodeURIComponent(projectCode)}/field-logs`]
    ];

    for (const [name, route] of routes) {
      await page.evaluate((hashRoute) => {
        window.location.hash = hashRoute;
      }, route);
      await new Promise(r => setTimeout(r, 2800));

      const stayButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const stay = buttons.find(b => (b.textContent || '').trim() === 'Ở lại');
        return !!stay;
      });
      if (stayButton) {
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const stay = buttons.find(b => (b.textContent || '').trim() === 'Ở lại');
          if (stay) stay.click();
        });
        await new Promise(r => setTimeout(r, 500));
      }

      for (let retry = 0; retry < 3; retry++) {
        const modalClosed = await page.evaluate(() => {
          const stayLabels = ['Ở lại', 'Hủy', 'Close', 'Đóng'];
          const buttons = Array.from(document.querySelectorAll('button'));

          for (const label of stayLabels) {
            const button = buttons.find((item) => (item.textContent || '').trim() === label);
            if (button) {
              button.click();
              return true;
            }
          }

          const closeIconButton = Array.from(document.querySelectorAll('button[title="Đóng"], button[aria-label="Đóng"], button.close-btn'))
            .pop();
          if (closeIconButton) {
            closeIconButton.click();
            return true;
          }

          return false;
        });

        if (!modalClosed) break;
        await new Promise(r => setTimeout(r, 450));
      }

      await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
      console.log(`Captured ${name}.png`);
    }
  }

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
