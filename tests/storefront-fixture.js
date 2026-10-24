/* Only loaded by tests/storefront-ui.html. No production database or order writes. */
(function () {
  'use strict';
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var target = document.getElementById(link.getAttribute('href').slice(1));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
  });
  var memory = {};
  Object.defineProperty(window, 'localStorage', { value: {
    getItem: function (key) { return memory[key] || null; },
    setItem: function (key, value) { memory[key] = String(value); }
  } });
  window.SUPABASE_URL = 'https://storefront.invalid';
  window.SUPABASE_ANON_KEY = 'fixture-only';
  var sample = [
    {listing_id:'fixture-1',card_id:'one',name:'Tatsugiri ex',set_name:'Surging Sparks',set_id:'sv08',number:'226',language:'en',rarity:'Ultra Rare',variant:'Holo',lot_condition:'A',price:85000,qty:3,created_at:'2026-10-24'},
    {listing_id:'fixture-2',card_id:'two',name:'Pikachu',set_name:'Evolving Skies',set_id:'swsh7',number:'049',language:'en',rarity:'Common',variant:'Reverse Holo',lot_condition:'New Mint',price:15000,qty:5,created_at:'2026-10-23'},
    {listing_id:'fixture-3',card_id:'three',name:'ピカチュウ',set_name:'ポケモンカード151',set_id:'SV2a',number:'025',language:'jp',rarity:'C',variant:'Reverse Holo',holo_pattern:'Poké Ball',lot_condition:'A',price:65000,qty:2,created_at:'2026-10-22'},
    {listing_id:'fixture-4',card_id:'four',name:'Charizard ex',set_name:'151',set_id:'sv03.5',number:'006',language:'en',rarity:'Double Rare',variant:'Holo',lot_condition:'B',price:180000,qty:1,created_at:'2026-10-21'},
    {listing_id:'fixture-5',card_id:'five',name:'Lugia V',set_name:'Silver Tempest',set_id:'swsh12',number:'138',language:'en',rarity:'Ultra Rare',variant:'Holo',lot_condition:'A',price:130000,qty:4,created_at:'2026-10-20'}
  ];
  window.fetch = async function (url, options) {
    var path = String(url);
    if (options && options.method && options.method !== 'GET') throw new Error('Fixture blocks all writes and order lookups.');
    if (path.indexOf('/rest/v1/storefront_listings?') >= 0) {
      if (window.STOREFRONT_FIXTURE_MODE === 'error') throw new Error('Fixture: network unavailable');
      return new Response(JSON.stringify(window.STOREFRONT_FIXTURE_MODE === 'empty' ? [] : sample), {status:200,headers:{'Content-Type':'application/json'}});
    }
    throw new Error('Unexpected fixture request: ' + path);
  };
})();
