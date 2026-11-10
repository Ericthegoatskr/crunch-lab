import assert from 'node:assert/strict';
import test from 'node:test';
import {matchLocale,messages} from '../src/locales.js';

test('uses the first supported browser preference and respects explicit Chinese scripts',()=>{
  assert.equal(matchLocale(['en-AU','zh-TW']),'en');
  assert.equal(matchLocale(['ja-JP','zh-TW','en-US']),'zh-Hant');
  assert.equal(matchLocale(['zh-HK']),'zh-Hant');
  assert.equal(matchLocale(['zh-CN']),'zh-Hans');
  assert.equal(matchLocale(['zh-Hans-TW']),'zh-Hans');
  assert.equal(matchLocale(['zh-Hant-CN']),'zh-Hant');
  assert.equal(matchLocale(['malformed_locale','zh-MO']),'zh-Hant');
  assert.equal(matchLocale(['fr-FR']),'en');
});

test('all languages cover the same interface messages and status variants',()=>{
  for(const locale of ['zh-Hant','zh-Hans']){
    assert.deepEqual(Object.keys(messages[locale]).sort(),Object.keys(messages.en).sort());
    assert.deepEqual(Object.keys(messages[locale].items),Object.keys(messages.en.items));
    assert.deepEqual(Object.keys(messages[locale].sideState),Object.keys(messages.en.sideState));
  }
});
