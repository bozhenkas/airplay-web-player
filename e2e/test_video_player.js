const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');

const TEST_PATHS = [
  '/Users/bozhenkas/Downloads/House.of.Cards.US.The.Complete.Series.576p.BluRay.TVShows.Eng.TeamHD/House.of.Cards.US.S01.576p.BluRay.TVShows.Eng.TeamHD/House.of.Cards.US.S01E04.576p.BluRay.TVShows.Eng.TeamHD.mkv',
  '/Users/bozhenkas/Downloads/The_Shawshank_Redemption_1080p.m4v',
  '/Users/bozhenkas/Documents/Скриншоты/Запись экрана 2025-05-27 в 20.30.24.mov',
];

async function runTest() {
  let driver = await new Builder()
    .forBrowser('chrome')
    // .setChromeOptions(new chrome.Options().addArguments('--headless')) // убираем headless
    .build();
  try {
    console.log('🧪 Запуск тестов...');
    await driver.get('http://localhost:3000');
    await driver.wait(until.titleContains('AirPlay'), 5000);
    const manualInput = await driver.findElement(By.css('.manual-path-input'));
    const openBtn = await driver.findElement(By.xpath("//button[contains(text(),'Открыть по пути')]"));

    for (const testPath of TEST_PATHS) {
      console.log(`\n🔎 Проверяю путь: ${testPath}`);
      await manualInput.clear();
      await manualInput.sendKeys(testPath);
      await openBtn.click();
      await driver.sleep(3000);

      // Проверяем наличие ошибки
      let errorText = '';
      try {
        const errorBlock = await driver.findElement(By.css('.error-message'));
        errorText = await errorBlock.getText();
      } catch (e) {
        // Ошибки нет — это хорошо
      }
      if (errorText) {
        console.log(`❌ Ошибка для ${testPath}: ${errorText}`);
      } else {
        // Проверяем наличие видео-элемента
        try {
          const video = await driver.findElement(By.css('video'));
          const src = await video.getAttribute('src');
          assert(src && src.includes('api/stream'), 'Видео-элемент не содержит src на стрим');
          console.log(`✅ Видео-элемент найден для ${testPath}`);
        } catch (e) {
          console.log(`❌ Видео-элемент не найден для ${testPath}`);
        }
      }
    }
    console.log('\n🎉 Проверка завершена!');
  } catch (e) {
    console.error('❌ Тест не пройден:', e.message);
    console.error('📍 Место ошибки:', e.stack);
    process.exit(1);
  } finally {
    await driver.quit();
    console.log('🔚 Браузер закрыт');
  }
}

runTest(); 