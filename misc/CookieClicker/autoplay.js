CM.Strategy = {};
CM.Strategy.oldPlaySound = CM.Disp.PlaySound;
CM.Strategy.oldRemakePP = CM.Cache.RemakePP;
CM.Strategy.timer = {};
CM.Strategy.timer.lastPop = Date.now();
CM.Strategy.timer.lastPurchaseCheck = Date.now();
CM.Strategy.bestBuy = {};
CM.Strategy.bestBuffer = 0;
CM.Strategy.clickInterval = undefined;
CM.Strategy.currentBuff = 1;
CM.Strategy.prevBuff = 0;
CM.Strategy.upgradesToIgnore = [
    "Golden switch [off]",
    "One mind",
    "Festive biscuit",
    "Ghostly biscuit",
    "Lovesick biscuit",
    "Fool's biscuit",
    "Bunny biscuit"]
CM.Strategy.specialPPfactor =
  { "Lucky day":          0.7,
    "Serendipity":        1.4,
    "Get lucky":          7.0,
    "Plastic mouse" :     0.01,
    "Iron mouse" :        0.01,
    "Titanium mouse" :    0.01,
    "Adamantium mouse" :  0.01,
    "Unobtainium mouse" : 0.01,
    "Eludium mouse" :     0.01,
    "Wishalloy mouse" :   0.01,
    "Fantasteel mouse" :  0.01,
    "Nevercrack mouse" :  0.01,
    "Armythril mouse" :   0.01,
  }

CM.Strategy.Interval = function(lower, upper) {
  return lower + (upper-lower)*Math.random();
}

CM.Strategy.clickingNeeded = function() {
  if (Object.keys(Game.buffs).length === 0)
    return false;
  return !!Game.buffs["Click frenzy"] || !!Game.buffs["Dragonflight"];
}

CM.Strategy.doClicking = function() {
  // We're called every .1 seconds, want some randomness to our clicking,
  // and want to average about 5 clicks per second
  if (Math.random() < 1/2) {
    Game.mouseX = Game.cookieOriginX+5;
    Game.mouseY = Game.cookieOriginY+5;
    Game.ClickCookie();
    if (!CM.Strategy.clickingNeeded()) {
      clearInterval(CM.Strategy.clickInterval);
      CM.Strategy.clickInterval = undefined;
      // Make there be a good gap between a clicking frenzy and any purchase
      // automatically made afterward.
      CM.Strategy.timer.lastPurchaseCheck = Date.now() + 5000;
    }
  }
}

CM.Strategy.shimmerAct = function() {
  // shimmerAppeared() won't be called after initiating cookie for cookie
  // chains and cookie Storms, so we need to check if there are more cookies
  // manually here.
  if (Game.shimmers.length)
    CM.Strategy.popOne();
  if (!CM.Strategy.clickInterval && CM.Strategy.clickingNeeded())
    CM.Strategy.clickInterval = setInterval(CM.Strategy.doClicking, 100);
}

CM.Strategy.popOne = function() {
  if (Date.now() - CM.Strategy.timer.lastPop > 1000) {
    Game.shimmers.some(function(shimmer) {
      if (shimmer.type !== 'golden' || shimmer.wrath === 0) {
        shimmer.pop();
        CM.Strategy.timer.lastPop = Date.now();
        setTimeout(CM.Strategy.shimmerAct, CM.Strategy.Interval(1000, 2000));
        return true;
      }
    });
  } else if (Game.shimmers.length) {
    setTimeout(CM.Strategy.popOne,
               1000 - (Date.now() - CM.Strategy.timer.lastPop))
  }
}

CM.Strategy.ShimmerAppeared = function() {
  min = 1000 * (1 + Game.shimmers[Game.shimmers.length-1].dur / 12)
  max = min + 4000
  setTimeout(CM.Strategy.popOne, CM.Strategy.Interval(min, max))
}

CM.Strategy.getTruePP = function(item, price) {
  // pp == Projected Payoff, mostly calculated by CookieMonster
  pp = Number.MAX_VALUE;
  cps = CM.Strategy.trueCpS;
  if (CM.Cache.Upgrades[item]) {
    // Do a special computation of projected payoff for particular items that
    // CookieMonster simply returns Infinity for.
    special_factor = CM.Strategy.specialPPfactor[item]
    if (special_factor) {
      pp = Game.Upgrades[item].getPrice() / special_factor / cps;
    } else {
      pp = CM.Cache.Upgrades[item].pp * CM.Strategy.currentBuff;
    }
  } else if (CM.Cache.Objects[item]) {
    pp = CM.Cache.Objects[item].pp * CM.Strategy.currentBuff;
  }

  // Return what we found
  return pp;
}

CM.Strategy.getCheapItem = function(item, price) {
  // pp == Projected Payoff, mostly calculated by CookieMonster.  We're not
  // actually calculating PP here, just returning a random small value if an
  // item is considered cheap enough.
  pp = Number.MAX_VALUE;
  cps = CM.Strategy.trueCpS;
  if (CM.Cache.Upgrades[item]) {
    // I don't want upgrades to sit around forever unbought, so put some
    // some minimum pp for all upgrades; besides, it's possible we need one
    // upgrade to unlock others.
    if (price < 1*cps)
      return 3.1415926535897932384626433832795; // arbitrary small number
  } else if (CM.Cache.Objects[item]) {
    // Building not only have the potential to unlock upgrades, they also
    // have value due to "building special" golden cookies so consider them
    // cheap up to a bit higher limits than upgrades.
    f = Math.min(5, 0.5*Math.log10(cps))
    if (price < f*cps)
      return 3.1415926535897932384626433832795; // arbitrary small number
  }

  // Return what we found
  return pp;
}

CM.Strategy.determineBestBuy = function(metric) {
  // First purchase is always a Cursor.  Also, when we haven't yet bought
  // anything, pp for all upgrades is NaN or Infinity, so we really do
  // need a special case here.
  if (Game.cookiesPs === 0) {
    return {name: "Cursor", price: Game.Objects.Cursor.getPrice(),
            pp: CM.Cache.Objects.Cursor.pp, obj: Game.Objects.Cursor}
  }

  // Find the item with the lowest projected payoff
  lowestPP = Number.MAX_VALUE;
  best = {};
  for (item in CM.Cache.Upgrades) {
    if (Game.Upgrades[item].unlocked) {
      if (CM.Strategy.upgradesToIgnore.indexOf(item) === -1) {
        price = Game.Upgrades[item].getPrice();
        pp = metric(item, price);
        if (pp < lowestPP) {
          lowestPP = pp;
          best = {name: item, price: price, pp: pp, obj: Game.Upgrades[item]}
        } //else { console.log(`Skipping ${item}; not better PP`) }
      } //else { console.log(`Skipping ${item}; in ignore list`) }
    } //else { console.log(`Skipping ${item}; not unlocked`) }
  }
  for (item in CM.Cache.Objects) {
    price = Game.Objects[item].getPrice();
    pp = metric(item, price);
    if (pp < lowestPP) {
      lowestPP = pp;
      best = {name: item, price: price, pp: pp, obj: Game.Objects[item]}
    } //else { console.log(`Skipping ${item}; not better PP`) }
  }
  return best
}

CM.Strategy.luckyExpectations = function() {
  // Get information about how often cookies appear
  mint = Game.shimmerTypes.golden.minTime/Game.fps;
  maxt = Game.shimmerTypes.golden.maxTime/Game.fps;
  used = Game.shimmerTypes.golden.time/Game.fps;

  // Determine how often they appear on average, rough estimate
  ave = 0.75*mint + 0.25*maxt;

  // Set the factors and determine the last type that appeared
  factors = {Frenzy: {full: 2.06, prob: 0.620},
             Lucky:  {full: 2.81, prob: 0.124},
             Other:  {full: 2.50, prob: 0.400}}
  map = {'frenzy': 'Frenzy', 'multiply cookies': 'Lucky'}
  lastType = map[Game.shimmerTypes.golden.last] || "Other"

  // Compute the expected time
  expected = ave * factors[lastType].full - used * factors[lastType].prob;

  // Even if probabilistically it's better to wait for "Lucky" golden cookie,
  // it's more fun to buy stuff early on, so set a fudge factor.  Besides,
  // sometimes the purchases have compounding effects.  For example,
  // purchasing farmer grandmas make farms more effective (already factored
  // into the PP of "farmer grandmas"), but will ALSO make future grandma
  // and farm purchases have a lower PP after the purchase.  We may well want
  // to buy those "more effective" grandmas and farms, but CookieMonster
  // won't display them to us until we have bought the upgrade.  So, err on
  // the side of purchasing.
  fudge_factor = (Math.PI+Math.E)/3;
  expected_lucky_time = fudge_factor * expected;

  // Also compute how much we are almost certain we can earn before we
  // get a golden cookie
  min_reasonable_time_until_gc = Math.min(0, (5.0/12*maxt)-used);
  cookies_before_gc = min_reasonable_time_until_gc * CM.Strategy.trueCpS;

  return [expected_lucky_time, cookies_before_gc];
}

CM.Strategy.determineBankBuffer = function() {
  var [expected_time, cookies_before_gc] = CM.Strategy.luckyExpectations();
  if (Game.cookiesPs === 0 || CM.Strategy.bestBuy.pp < expected_time)
    return 0;
  // FIXME: Extend the bank buffer if spells can be cast
  if (Game.Upgrades["Get lucky"].bought)
    return CM.Cache.LuckyFrenzy - cookies_before_gc;
  else
    return CM.Cache.Lucky - cookies_before_gc;
}

CM.Strategy.handlePurchases = function() {
  // Don't run this function too often
  if (Date.now() - CM.Strategy.timer.lastPurchaseCheck < 5000)
    return;
  CM.Strategy.timer.lastPurchaseCheck = Date.now();

  // Don't buy upgrades or buildings while in a clickfest
  if (CM.Strategy.clickInterval)
    return;

  // Don't bother computing best thing to purchase if we already know we
  // don't have enough.
  CM.Strategy.bestBuffer = CM.Strategy.determineBankBuffer();
  if (CM.Cache.lastCookies < CM.Strategy.bestBuffer)
    return;

  // Find out what to purchase
  CM.Strategy.bestBuy = CM.Strategy.determineBestBuy(CM.Strategy.getTruePP);
  if (!CM.Strategy.bestBuy.name) {
    console.error("Something is wrong; couldn't find a best buy.");
    return;
  }

  // If we don't have enough to buy the best item, check for super cheap items
  if (CM.Cache.lastCookies <
      CM.Strategy.bestBuffer + CM.Strategy.bestBuy.price) {
    CM.Strategy.bestBuy=CM.Strategy.determineBestBuy(CM.Strategy.getCheapItem);
  }

  // Purchase if we have enough
  if (CM.Cache.lastCookies >=
      CM.Strategy.bestBuffer + CM.Strategy.bestBuy.price) {

    // Determine if we should buy in bulk
    bulk_amount = 1;
    for (count of [10, 100]) {
      cost_factor = (Math.pow(1.15,count) - 1) / (1.15 - 1);
      total_cost = CM.Strategy.bestBuy.price * cost_factor;
      if (total_cost < 5*CM.Strategy.trueCpS &&
          CM.Cache.lastCookies >= CM.Strategy.bestBuffer + total_cost)
        bulk_amount = count;
    }

    // Log what we're doing
    console.log(`Bought ${bulk_amount} ${CM.Strategy.bestBuy.name}(s) `+
                `(with PP of ${CM.Disp.Beautify(CM.Strategy.bestBuy.pp)}) ` +
                `at ${Date().toString()}`)

    // Make sure we buy bulk_amount
    var orig = [Game.buyMode, Game.buyBulk];
    [Game.buyMode, Game.buyBulk] = [1, bulk_amount];

    // Buy it.
    CM.Strategy.bestBuy.obj.buy();

    // restore values we temporarily over-wrote, and blank out bestBuy for
    // next time
    [Game.buyMode, Game.buyBulk] = orig;
    CM.Strategy.bestBuy = {};
  }
}

//
// Monkey patching to hook into the relevant parts of CookieMonster follow
//

CM.Disp.PlaySound = function(url) {
  // CM.Disp.PlaySound is called unconditionally, but then checks the options
  // to determine whether to actually play the sound, so even if the sound
  // option is off, we can use this to auto-click golden cookies.  :-)
  CM.Strategy.ShimmerAppeared();
  CM.Strategy.oldPlaySound(url);
}

CM.Cache.RemakePP = function() {
  CM.Strategy.oldRemakePP()

  // Determine currentBuff and trueCpS, not temporary CpS going on now
  mult = 1;
  Object.keys(Game.buffs).forEach(name => {
    if (Game.buffs[name].multCpS) mult *= Game.buffs[name].multCpS});
  CM.Strategy.currentBuff = mult;
  CM.Strategy.trueCpS = Game.cookiesPs / CM.Strategy.currentBuff;

  // Do purchases
  CM.Strategy.handlePurchases();
}
