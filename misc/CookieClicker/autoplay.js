CM.Strategy = {};
CM.Strategy.oldPlaySound = CM.Disp.PlaySound;
CM.Strategy.oldRemakePP = CM.Cache.RemakePP;
CM.Strategy.timer = {};
CM.Strategy.timer.lastPop = Date.now();
CM.Strategy.timer.lastPurchaseCheck = Date.now();
CM.Strategy.spiritOfRuinDelayTokens = 0;
CM.Strategy.spiritOfRuinDelayBeforeBuying = false;
CM.Strategy.logHandOfFateCookie = false;
CM.Strategy.clickInterval = undefined;
CM.Strategy.currentBuff = 1;
CM.Strategy.prevBuff = 0;
CM.Strategy.upgradesToIgnore = [
    "Golden switch [off]",
    "Golden switch [on]",
    "Background selector",
    "Milk selector",
    "One mind",
    "Communal brainsweep",
    "Elder Pact",
    "Elder Covenant",
    "Elder Pledge",
    "Festive biscuit",
    "Ghostly biscuit",
    "Lovesick biscuit",
    "Fool's biscuit",
    "Bunny biscuit",
    "Chocolate egg"]
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

CM.Strategy.costToPurchase = function(count, base_price) {
  cost_factor = (Math.pow(1.15,count) - 1) / (1.15 - 1);
  return cost_factor * base_price;
}

CM.Strategy.spiritOfRuinActions = function() {
  action_taken = true;

  // If the buff ends for needing to click, don't bother taking any further
  // action.
  if (!CM.Strategy.clickingNeeded()) {
    CM.Strategy.spiritOfRuinDelayTokens = 0;
    CM.Strategy.spiritOfRuinDelayBeforeBuying = false;
    return !action_taken;
  }

  // Whenever we previously took an action, we need to delay a bit before
  // taking another, to mimic how a real human would behave.
  if (CM.Strategy.spiritOfRuinDelayTokens > 0) {
    CM.Strategy.spiritOfRuinDelayTokens -= 1;
    // Technically we didn't take an action, but we pretend we did because
    // we don't want clicking on the big cookie to happen during our
    // "delay before next action"
    return action_taken;
  }

  // If pantheon minigame available and spirit of ruin selected and we don't
  // already have a buff from the spirit of ruin
  pantheon = Game.Objects["Temple"].minigame;
  if (pantheon && Game.hasGod("ruin") && !Game.buffs["Devastation"]) {

    // Determine if we need to buy more cursors
    base_cursor_cost = Game.Objects.Cursor.getPrice();
    cursor_cost = CM.Strategy.costToPurchase(100, base_cursor_cost);
    if (cursor_cost < CM.Strategy.trueCpS) {

      // We should not buy immediately after a Devastation buff ends; there
      // should be some kind of natural delay.
      if (CM.Strategy.spiritOfRuinDelayBeforeBuying) {
        CM.Strategy.spiritOfRuinDelayBeforeBuying = false;
        CM.Strategy.spiritOfRuinDelayTokens = CM.Strategy.Interval(5, 7);
        return action_taken;
      }

      // Buy cursors!
      [oldMode, Game.buyMode] = [Game.buyMode, 1];
      Game.Objects.Cursor.buy(100);
      Game.buyMode = oldMode;
      Game.Objects.Cursor.refresh();
      CM.Strategy.spiritOfRuinDelayTokens = CM.Strategy.Interval(1, 3);
      return action_taken;

    } else if (Game.Objects.Cursor.amount &&
               Game.buffs["Click frenzy"].time/Game.fps > 5) {
      // Sell cursors!
      Game.Objects.Cursor.sell(-1);
      Game.Objects.Cursor.refresh();
      CM.Strategy.spiritOfRuinDelayTokens = CM.Strategy.Interval(4, 6);
      CM.Strategy.spiritOfRuinDelayBeforeBuying = true;
      return action_taken;
    }
  }

  // We didn't do anything, let caller know they can click the big cookie
  return !action_taken;
}

CM.Strategy.doClicking = function() {
  // Check if we can boost our click power by buying and selling buildings
  if (CM.Strategy.spiritOfRuinActions()) {
    // Buying and selling buildings and simultaneously clicking on the big
    // cookie isn't something a human would be able to do, so just return
    // early.
    return
  }

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

CM.Strategy.hand_of_fate_if_good_time = function() {
  // Every building special is named something different in Game.buffs; we
  // have to look at Game.buffs[whatever].type.name instead and compare to
  // "building buff"
  building_special = Object.entries(Game.buffs).some(([key,buff]) =>
                                    {return buff.type.name == "building buff"})
  grimoire = Game.Objects["Wizard tower"].minigame
  // If our magic is at least half way between needed to cast HandOfFate and
  // full, and we have Frenzy plus either DragonHarvest or BuildingSpecial
  if (grimoire.magic > 5 + 0.8 * grimoire.magicM &&
      Game.buffs["Frenzy"] &&
      (Game.buffs["Dragon Harvest"] || building_special)) {
    // Cast the hand of fate, and trigger a timeout to act on it
    grimoire.castSpell(grimoire.spells["hand of fate"])
    CM.Strategy.logHandOfFateCookie = true;
    setTimeout(CM.Strategy.shimmerAct, CM.Strategy.Interval(3000, 4000))
  }
}

CM.Strategy.shimmerAct = function() {
  // shimmerAppeared() won't be called after initiating cookie for cookie
  // chains and cookie Storms, so we need to check if there are more cookies
  // manually here.
  if (Game.shimmers.length)
    CM.Strategy.popOne();

  // After a golden cookie is clicked, check to see if it was one that
  // needs lots of clicking on the big cookie
  if (!CM.Strategy.clickInterval && CM.Strategy.clickingNeeded())
    CM.Strategy.clickInterval = setInterval(CM.Strategy.doClicking, 100);

  // Otherwise, check to see if we want to take advantage of some spell
  // casting
  else if (Game.Objects["Wizard tower"].minigame)
    CM.Strategy.hand_of_fate_if_good_time()
}

CM.Strategy.popOne = function() {
  if (Date.now() - CM.Strategy.timer.lastPop > 1000) {
    Game.shimmers.some(function(shimmer) {
      if (shimmer.type !== 'golden' || shimmer.wrath === 0) {
        shimmer.pop();
        CM.Strategy.timer.lastPop = Date.now();
        setTimeout(CM.Strategy.shimmerAct, CM.Strategy.Interval(1000, 2000));
        if (CM.Strategy.logHandOfFateCookie) {
          CM.Strategy.logHandOfFateCookie = false;
          console.log(`Hand of Fate resulted in ` +
                      `${Game.shimmerTypes.golden.last} ` +
                      `golden cookie at ${Date().toString()}`)
        }
        return true;
      }
      else if (CM.Strategy.logHandOfFateCookie &&
               shimmer.type === 'golden' && shimmer.wrath) {
        CM.Strategy.logHandOfFateCookie = false;
        console.log(`Hand of Fate resulted in wrath cookie at ` +
                    `${Date().toString()}`)
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

CM.Strategy.determineBankBuffer = function(item_pp) {
  var [expected_time, cookies_before_gc] = CM.Strategy.luckyExpectations();
  if (Game.cookiesPs === 0 || item_pp < expected_time)
    return 0;
  // FIXME: Extend the bank buffer if spells can be cast
  if (Game.Upgrades["Get lucky"].bought) {
    if (Game.Objects["Wizard tower"].minigame &&
        Game.Objects["Wizard tower"].minigame.magicM >= 20)
      // Frenzy + (DragonHarvest | BuildingSpecial) + Conjure Baked Goods:
      //   Conjure Baked Goods is basically 2x lucky (if buffer of cookies in
      //   bank is enough), so if we assume BuildingSpecial == DragonHarvest
      //   (== 15), then we need 2*15*LuckyFrenzy.
      return 15*CM.Cache.LuckyFrenzy - cookies_before_gc;
    else
      return CM.Cache.LuckyFrenzy - cookies_before_gc;
  }
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

  // Find out what to purchase
  bestBuy = CM.Strategy.determineBestBuy(CM.Strategy.getTruePP);
  bestBuffer = CM.Strategy.determineBankBuffer(bestBuy.pp);

  // If we don't have enough to buy the best item, check for super cheap items
  if (CM.Cache.lastCookies < bestBuffer + bestBuy.price) {
    bestBuy = CM.Strategy.determineBestBuy(CM.Strategy.getCheapItem);
    // bestBuy could be {} here
    if (bestBuy.name)
      bestBuffer = 0;
  }

  // Purchase if we have enough
  if (bestBuy.price && CM.Cache.lastCookies >= bestBuffer + bestBuy.price) {

    // Determine if we should buy in bulk
    bulk_amount = 1;
    if (bestBuy.name in Game.Objects) {
      for (count of [10, 100]) {
        total_cost = CM.Strategy.costToPurchase(count, bestBuy.price)
        if (total_cost < 5*CM.Strategy.trueCpS &&
            CM.Cache.lastCookies >= total_cost)
          bulk_amount = count;
      }
    }

    // Log what we're doing
    console.log(`Bought ${bulk_amount} ${bestBuy.name}(s) `+
                `(with PP of ${CM.Disp.Beautify(bestBuy.pp)}) ` +
                `at ${Date().toString()}`)

    // Make sure we buy bulk_amount
    var orig = [Game.buyMode, Game.buyBulk];
    [Game.buyMode, Game.buyBulk] = [1, bulk_amount];

    // Buy it.
    bestBuy.obj.buy();

    // restore values we temporarily over-wrote
    [Game.buyMode, Game.buyBulk] = orig;
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
