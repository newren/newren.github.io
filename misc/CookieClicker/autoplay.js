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

CM.Strategy.determineBestBuy = function() {
  // FIXME: Handle GetLucky and cursors and such
  ignore = ["Golden switch [off]", "One mind", "Heavenly chip secret"]
  for (item in CM.Cache.Upgrades) {
    if (CM.Cache.Upgrades[item].color == "Blue") {
      if (Game.Upgrades[item].unlocked) {
        if (ignore.indexOf(item) === -1) {
          price = Game.Upgrades[item].getPrice()
          return {name: item, price: price, pp: CM.Cache.Upgrades[item].pp,
                  obj: Game.Upgrades[item]}
        } //else { console.log(`Skipping ${item}; in ignore list`) }
      } //else { console.log(`Skipping ${item}; not unlocked`) }
    } //else { console.log(`Skipping ${item}; not blue`) }
  }
  lowest = Number.MAX_SAFE_INTEGER;
  best = {}
  for (item in CM.Cache.Objects) {
    if (CM.Cache.Objects[item].pp < lowest) {
      lowest = CM.Cache.Objects[item].pp
      price = Game.Objects[item].getPrice()
      best = {name: item, price: price, pp: CM.Cache.Objects[item].pp,
              obj: Game.Objects[item]}
    } //else { console.log(`Skipping ${item}; not green`) }
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
