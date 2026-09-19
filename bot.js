// ============================================
// bot.js - Facebook Auto Accept Friend Requests
// ============================================

const puppeteer = require('puppeteer');

// ---------- 1. الإعدادات ----------
const CREDENTIALS = {
  email: process.env.FB_EMAIL,
  password: process.env.FB_PASSWORD,
};

const CONFIG = {
  maxRequestsPerRun: 3,
  headless: true,
  delays: {
    tiny:   [200, 600],
    short:  [800, 1800],
    medium: [2000, 4000],
    long:   [5000, 9000],
  },
};

// ---------- 2. دوال التأخير البشري ----------
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanDelay(range) {
  const [min, max] = range;
  const base = randomBetween(min, max);
  const noise = Math.floor(base * (Math.random() * 0.3 - 0.15));
  const finalDelay = Math.max(100, base + noise);
  console.log(`   ⏳ انتظار ${finalDelay}ms`);
  return new Promise(resolve => setTimeout(resolve, finalDelay));
}

// ---------- 3. الدالة الرئيسية ----------
async function main() {
  console.log('🚀 بدء تشغيل البوت...\n');

  // 🔍 تشخيص مؤقت - سيساعدنا في معرفة سبب المشكلة
  console.log('🔍 ====== تشخيص متغيرات البيئة ======');
  console.log('🔍 FB_EMAIL:', process.env.FB_EMAIL ? `موجود (طول: ${process.env.FB_EMAIL.length})` : '❌ غير موجود');
  console.log('🔍 FB_PASSWORD:', process.env.FB_PASSWORD ? `موجود (طول: ${process.env.FB_PASSWORD.length})` : '❌ غير موجود');
  const fbVars = Object.keys(process.env).filter(k => k.startsWith('FB_'));
  console.log('🔍 كل المتغيرات التي تبدأ بـ FB_:', fbVars.length > 0 ? fbVars : '(لا شيء)');
  console.log('🔍 ====================================\n');

  // التحقق من وجود بيانات الدخول
  if (!CREDENTIALS.email || !CREDENTIALS.password) {
    console.error('❌ خطأ: FB_EMAIL أو FB_PASSWORD غير موجودة في Secrets');
    console.error('💡 تحقق من: Settings → Secrets and variables → Actions → Repository secrets');
    process.exit(1);
  }
  console.log(`✅ تم تحميل بيانات الدخول (البريد: ${CREDENTIALS.email.substring(0, 3)}***)\n`);

  // تشغيل المتصفح
  console.log('🌐 تشغيل المتصفح...');
  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = await browser.newPage();

  // تحسين التخفي
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1366, height: 768 });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  try {
    // ---------- تسجيل الدخول ----------
    console.log('🔐 تسجيل الدخول إلى Facebook...');
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    await humanDelay(CONFIG.delays.short);

    // إدخال البريد
    console.log('   📝 إدخال البريد الإلكتروني...');
    await page.waitForSelector('#email', { timeout: 15000 });
    await page.type('#email', CREDENTIALS.email, { delay: 50 });
    await humanDelay(CONFIG.delays.tiny);

    // إدخال كلمة المرور
    console.log('   📝 إدخال كلمة المرور...');
    await page.type('#pass', CREDENTIALS.password, { delay: 50 });
    await humanDelay(CONFIG.delays.tiny);

    // الضغط على زر الدخول
    console.log('   🖱️ الضغط على زر الدخول...');
    await page.click('button[name="login"]');
    console.log('   ⏳ انتظار تحميل الصفحة...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    await humanDelay(CONFIG.delays.medium);

    // التحقق من نجاح الدخول
    const currentUrl = page.url();
    console.log(`   📍 URL الحالي: ${currentUrl}`);

    if (currentUrl.includes('login') || currentUrl.includes('checkpoint')) {
      console.error('❌ فشل تسجيل الدخول - قد يكون هناك تحقق أمني');
      console.error('   تحقق من البريد وكلمة المرور، أو من وجود 2FA');
      await page.screenshot({ path: 'login-failed.png' });
      throw new Error('فشل تسجيل الدخول');
    }

    console.log('✅ تم تسجيل الدخول\n');

    // ---------- صفحة طلبات الصداقة ----------
    console.log('📨 الانتقال إلى صفحة طلبات الصداقة...');
    await page.goto('https://www.facebook.com/friends/requests/', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await humanDelay(CONFIG.delays.long);

    console.log('✅ تم فتح صفحة الطلبات\n');

    // ---------- البحث عن أزرار القبول ----------
    console.log('🔍 البحث عن أزرار "قبول"...');

    const selectors = [
      'div[aria-label="قبول"]',
      'div[aria-label="Confirm"]',
      'div[aria-label="Accept"]',
      'div[aria-label="Accept friend request"]',
    ];

    let acceptButtons = [];
    for (const sel of selectors) {
      const found = await page.$$(sel);
      if (found.length > 0) {
        console.log(`   ✅ وجد ${found.length} زر بـ selector: ${sel}`);
        acceptButtons = found;
        break;
      }
    }

    console.log(`   📊 المجموع: ${acceptButtons.length} زر قبول\n`);

    if (acceptButtons.length === 0) {
      console.log('ℹ️ لا يوجد طلبات جديدة حالياً');
    } else {
      const toAccept = Math.min(acceptButtons.length, CONFIG.maxRequestsPerRun);
      console.log(`🎯 سنقبل ${toAccept} طلب...\n`);

      for (let i = 0; i < toAccept; i++) {
        try {
          console.log(`📌 قبول الطلب ${i + 1}/${toAccept}...`);
          await acceptButtons[i].click();
          await humanDelay(CONFIG.delays.medium);
        } catch (err) {
          console.log(`   ⚠️ فشل قبول الطلب ${i + 1}: ${err.message}`);
        }
      }
    }

    // ---------- صورة للتشخيص ----------
    await page.screenshot({ path: 'screenshot.png', fullPage: false });
    console.log('\n📸 تم حفظ صورة للصفحة');

    console.log('\n✅ انتهى البوت بنجاح');

  } catch (error) {
    console.error('\n❌ حدث خطأ أثناء التشغيل:');
    console.error(error.message);

    try {
      await page.screenshot({ path: 'error.png' });
      console.log('📸 تم حفظ صورة الخطأ في error.png');
    } catch (e) {}

    process.exit(1);
  } finally {
    await browser.close();
  }
}

// تشغيل البوت
main();
