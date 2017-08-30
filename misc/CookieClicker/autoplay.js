CM.Strategy = {};
CM.Strategy.oldPlaySound = CM.Disp.PlaySound;
CM.Strategy.timer = {};
CM.Strategy.timer.lastPop = Date.now();
CM.Strategy.timer.lastPurchase = Date.now();
CM.Strategy.timer.lastBuyCheck = Date.now();
CM.Strategy.bestBuy = {};
CM.Strategy.bestBuffer = 0;
CM.Strategy.purchaseInterval = undefined;
CM.Strategy.clickInterval = undefined;

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
      if (shimmer.wrath == 0) {
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
  setTimeout(CM.Strategy.popOne, CM.Strategy.Interval(3000, 4000))
}

CM.Disp.PlaySound = function(url) {
  // CM.Disp.PlaySound is called unconditionally, but then checks the options
  // to determine whether to actually play the sound, so even if the sound
  // option is off, we can use this to auto-click golden cookies.  :-)
  CM.Strategy.ShimmerAppeared();
  CM.Strategy.oldPlaySound(url);
}

CM.Strategy.cachePurchaseInfo = function() {
  // First, determine the current multiplicative factor from active buffs
  mult = 1;
  Object.keys(Game.buffs).forEach(name => {mult *= Game.buffs[name].multCpS});
  CM.Strategy.currentBuff = mult;

  // get a short name for a value we use repeatedly below
  trueCpS = CM.Strategy.trueCpS;

  // Second, compute a projected payoff for special items; CookieMonster just
  // gives Infinity for all of these.
  CM.Strategy.specialPPs = {
    "Lucky day":   Game.Upgrades["Lucky day"].getPrice()  / .7/trueCpS,
    "Serendipity": Game.Upgrades["Serendipity"].getPrice()/1.4/trueCpS,
    "Get Lucky":   Game.Upgrades["Get lucky"].getPrice()  /7.0/trueCpS,
  }
  mice = ["Plastic mouse",
          "Iron mouse",
          "Titanium mouse",
          "Adamantium mouse",
          "Unobtainium mouse",
          "Eludium mouse",
          "Wishalloy mouse",
          "Fantasteel mouse",
          "Nevercrack mouse",
          "Armythril mouse"]
  mice.forEach(mouse =>
               {CM.Strategy.specialPPs[mouse] =
                   Game.Upgrades[mouse].getPrice() / 0.01/trueCpS})
}

CM.Strategy.getTruePP = function(item, price) {
  pp = NaN; // pp == Projected Payoff, mostly calculated by CookieMonster
  if (CM.Cache.Upgrades[item]) {
    // I don't want upgrades to sit around forever unbought, so put some
    // some minimum pp for all upgrades; besides, it's possible we need one
    // upgrade to unlock others.
    if (price < 1*CM.Strategy.trueCpS)
      return 3.1415926535897932384626433832795; // arbitrary small number
    pp = CM.Cache.Upgrades[item].pp * CM.Strategy.currentBuff;
  } else if (CM.Cache.Objects[item]) {
    // Building also has value due to building special golden cookies, and
    // because it can unlock upgrades
    factor = Math.min(5, 0.5*Math.log10(CM.Strategy.trueCpS))
    if (price < factor * CM.Strategy.trueCpS)
      return 3.1415926535897932384626433832795; // arbitrary small number
    pp = CM.Cache.Objects[item].pp * CM.Strategy.currentBuff;
  }
  if (CM.Strategy.specialPPs[item])
    pp = CM.Strategy.specialPPs[item]
  return pp;
}

CM.Strategy.determineBestBuy = function() {
  // First purchase is always a Cursor.  Also, when we haven't yet bought
  // anything, pp for all upgrades is NaN or Infinity, so we really do
  // need a special case here.
  if (Game.cookiesPs === 0) {
    return {name: "Cursor", price: Game.Objects.Cursor.getPrice(),
            pp: CM.Cache.Objects.Cursor.pp, obj: Game.Objects.Cursor}
  }

  // Determine the current buff so we can get corrected pp values
  CM.Strategy.cachePurchaseInfo();

  // Find the item with the lowest projected payoff
  lowestPP = Number.MAX_SAFE_INTEGER;
  best = {};
  ignore = ["Golden switch [off]", "One mind"]
  for (item in CM.Cache.Upgrades) {
    if (Game.Upgrades[item].unlocked) {
      if (ignore.indexOf(item) === -1) {
        price = Game.Upgrades[item].getPrice();
        pp = CM.Strategy.getTruePP(item, price);
        if (pp < lowestPP) {
          lowestPP = pp;
          best = {name: item, price: price, pp: pp, obj: Game.Upgrades[item]}
        } //else { console.log(`Skipping ${item}; not better PP`) }
      } //else { console.log(`Skipping ${item}; in ignore list`) }
    } //else { console.log(`Skipping ${item}; not unlocked`) }
  }
  for (item in CM.Cache.Objects) {
    price = Game.Objects[item].getPrice();
    pp = CM.Strategy.getTruePP(item, price);
    if (pp < lowestPP) {
      lowestPP = pp;
      best = {name: item, price: price, pp: pp, obj: Game.Objects[item]}
    } //else { console.log(`Skipping ${item}; not better PP`) }
  }
  return best
}

CM.Strategy.determineBankBuffer = function() {
  if (Game.cookiesPs === 0 || CM.Strategy.bestBuy.pp < 300)
    return 0;
  // FIXME: Extend the bank buffer if spells can be cast
  if (Game.Upgrades["Get lucky"].bought)
    return CM.Cache.LuckyFrenzy;
  else
    return CM.Cache.Lucky;
}

CM.Strategy.handlePurchases = function() {
  // Don't buy upgrades or buildings while in a clickfest
  if (CM.Strategy.clickInterval)
    return;

  // Determine trueCpS, not the temporary CpS we are experiencing now
  CM.Strategy.trueCpS = Game.cookiesPs / CM.Strategy.currentBuff;

  // Re-determine the best thing to purchase
  if (Date.now() - CM.Strategy.timer.lastBuyCheck > 60000 ||
      !CM.Strategy.bestBuy.item) {
    CM.Strategy.bestBuy = CM.Strategy.determineBestBuy();
    CM.Strategy.bestBuffer = CM.Strategy.determineBankBuffer();
    CM.Strategy.timer.lastBuyCheck = Date.now();
  }

  // If we have enough cookies, make the purchase
  if (CM.Cache.lastCookies >=
      CM.Strategy.bestBuffer + CM.Strategy.bestBuy.price) {
    if (Date.now() - CM.Strategy.timer.lastPurchase > 1000) {
      console.log(`Bought ${CM.Strategy.bestBuy.name} at ${Date().toString()}`)
      var orig = [Game.buyMode, Game.buyBulk];
      [Game.buyMode, Game.buyBulk] = [1, 1];
      CM.Strategy.bestBuy.obj.buy();
      [Game.buyMode, Game.buyBulk] = orig;
      CM.Strategy.timer.lastPurchase = Date.now();
      CM.Strategy.bestBuy = {};
    }
  }
}

CM.Strategy.purchaseInterval = setInterval(CM.Strategy.handlePurchases, 1000)
