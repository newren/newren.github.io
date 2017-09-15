// autoplay.js: An extension to make Cookie Clicker more like IdleRPG
//
// This extension models a human-like player with below average reaction
// time and speed.  It basically does just a few things:
//   * Makes purchases (max of 1 purchase per five seconds)
//   * Clicks on golden cookies and reindeer (after human-like delay)
//   * Clicks on the big cookie during ClickFrenzies/DragonFlights
//     (5 or so times per second, after human like delay)
//   * Occasionally takes advantage of Pantheon/Grimoire if conditions
//     are just right (including buying AND selling buildings)
//
// The mediocre reaction time has a few downsides, which I intend to not fix:
//   * It often fails to complete chains from golden cookies
//   * During a cookie storm it only gets at most one cookie per second,
//     and misses all of them the first couple seconds.  Most humans get
//     far more.
//
// There are also many things this extension doesn't do:
//   * Anything related to the Grandmapocalypse (e.g. won't pop wrinklers)
//   * It won't ascend to heaven, or purchase heavenly upgrades for you
//   * It won't purchase various upgrades:
//     * Anything that starts, advances, pauses, or ends the grandmapocalypse
//     * The chocolate egg at easter (better saved until you want to ascend)
//   * It won't toggle switches (mostly from heavenly upgrades):
//     * The season switching biscuits
//     * The milk selector
//     * The background selector
//     * The golden switch
//   * It won't interact with Krumblor (the dragon)
//   * It won't select spirits for the Pantheon minigame
//   * It won't cast most the spells from the Grimoire minigame
//   * It only collects achievements for things related to normal operations
//     (buying buildings, clicking on golden cookies, maybe an occasional
//      spell); special achievements (renaming the bakery, dunking the big
//      cookie, etc.) are for a real human to collect
//
// Most of the things it doesn't do are things you probably would only want to
// do rather infrequently, thus this extension mostly removes the motivation
// to frequently check on the game and makes it more of an infrequent check-up
// and tweaking.  Just the way I like it.

CM.Strategy = {};
CM.Strategy.oldPlaySound = CM.Disp.PlaySound;
CM.Strategy.oldRemakePP = CM.Cache.RemakePP;
CM.Strategy.timer = {};
CM.Strategy.timer.lastPop = Date.now();
CM.Strategy.timer.lastPurchaseCheck = Date.now();
CM.Strategy.lastResets = Game.resets - 1;
CM.Strategy.buildingMax = {};
CM.Strategy.spiritOfRuinDelayTokens = 0;
CM.Strategy.spiritOfRuinDelayBeforeBuying = false;
CM.Strategy.spiritOfRuinPreviousCursors = 0;
CM.Strategy.logHandOfFateCookie = false;
CM.Strategy.clickInterval = undefined;
CM.Strategy.currentBuff = 1;
CM.Strategy.currentNumBuffs = 0; // Normal only, not click buffs
CM.Strategy.currentBuffTimeLeft = 0;
CM.Strategy.currentClickBuff = 1;
CM.Strategy.currentClickBuffTimeLeft = 0;
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
  { "Lucky day":          1.4,
    "Serendipity":        2.9,
    "Get lucky":          8.3,
    "Plastic mouse" :     0.04,
    "Iron mouse" :        0.04,
    "Titanium mouse" :    0.09,
    "Adamantium mouse" :  0.09,
    "Unobtainium mouse" : 0.09,
    "Eludium mouse" :     0.71,
    "Wishalloy mouse" :   0.71,
    "Fantasteel mouse" :  0.71,
    "Nevercrack mouse" :  0.71,
    "Armythril mouse" :   0.71,
  }
// Assumes Dragon Harvest aura is active.  Stacked power-ups are cool.
CM.Strategy.expected_factors = {  // Monte Carlo FTW
  Frenzy       : { Frenzy:  2.82, Lucky:  1.95, Other:  2.26, Overall:  2.36 },
  Lucky        : { Frenzy:  1.95, Lucky:  2.82, Other:  2.26, Overall:  2.36 },
  DHBS         : { Frenzy:  4.18, Lucky:  4.18, Other:  4.48, Overall:  4.25 },
  BS           : { Frenzy:  7.59, Lucky:  7.58, Other:  7.89, Overall:  7.66 },
  DH           : { Frenzy:  9.90, Lucky:  9.90, Other: 10.21, Overall:  9.97 },
  ClickFrenzy  : { Frenzy: 19.27, Lucky: 19.26, Other: 19.57, Overall: 19.34 },
  FrenzyXLucky : { Frenzy:  3.70, Lucky:  5.65, Other:  5.96, Overall:  4.97 },
  FrenzyXDHoBS : { Frenzy: 10.58, Lucky: 12.53, Other: 12.84, Overall: 11.85 },
  FrenzyXBS    : { Frenzy: 20.43, Lucky: 22.37, Other: 22.68, Overall: 21.70 },
  FrenzyXDH    : { Frenzy: 27.15, Lucky: 29.10, Other: 29.43, Overall: 28.43 }
}


CM.Strategy.Interval = function(lower, upper) {
  return lower + (upper-lower)*Math.random();
}

CM.Strategy.clickingNeeded = function() {
  return CM.Strategy.currentClickBuff > 1;
}

CM.Strategy.costToPurchase = function(count, base_price) {
  cost_factor = (Math.pow(1.15,count) - 1) / (1.15 - 1);
  return cost_factor * base_price;
}

CM.Strategy.spiritOfRuinActions = function() {
  action_taken = true;

  // If the buff ends for needing to click, don't bother taking any further
  // action.
  if (!CM.Strategy.clickingNeeded() &&
      Game.Objects.Cursor.amount >= CM.Strategy.spiritOfRuinPreviousCursors) {
    CM.Strategy.spiritOfRuinDelayTokens = 0;
    CM.Strategy.spiritOfRuinDelayBeforeBuying = false;
    CM.Strategy.spiritOfRuinPreviousCursors = 0;
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

  // If clicking is over, buy back whatever cursors we had
  if (!CM.Strategy.clickingNeeded()) {
    // Determine how many to buy at a time
    num = CM.Strategy.spiritOfRuinPreviousCursors - Game.Objects.Cursor.amount;
    num = (num >= 100) ? 100 : ((num >= 10) ? 10 : 1);

    // Buy them
    [oldMode, Game.buyMode] = [Game.buyMode, 1];
    Game.Objects.Cursor.buy(num);
    Game.buyMode = oldMode;
    Game.Objects.Cursor.refresh();

    // Add a slight delay before buying more
    CM.Strategy.spiritOfRuinDelayTokens = CM.Strategy.Interval(1, 3);
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
               CM.Strategy.currentClickBuffTimeLeft > 3) {
      // Sell cursors!
      if (CM.Strategy.spiritOfRuinPreviousCursors == 0)
        CM.Strategy.spiritOfRuinPreviousCursors = Game.Objects.Cursor.amount;
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
  // Recompute the buffs as we use that info in some of our sub-functions
  // (mostly just to see if there's still a clicking buff or whether there's
  // enough time left in it to do more spiritOfRuinActions)
  CM.Strategy.recomputeBuffs();

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

CM.Strategy.cbg_better_than_fhof = function(just_determining_bank_buffer) {
  if (just_determining_bank_buffer) {
    // buff_time will be min'ed with 26 or 13, we don't want to limit further
    // than that, so just pick something arbitrarily large.
    buff_time = Number.MAX_VALUE;

    // We may not have a sufficient bank of cookies now, but if having a
    // sufficient bank of cookies would lead to ability to cast more effective
    // spells then we want to make sure to set the bank buffer large enough.
    // So, see what is the better spell if we assume sufficiently many banked
    // cookies.
    ratio_of_desired_buffer = 1;
  } else { // actively trying to cast a spell
    buff_time = CM.Strategy.currentBuffTimeLeft;
    buff_mult = CM.Strategy.currentBuff;

    // If we were to cast conjure baked goods, what percentage of the optimal
    // number of cookies could we hope to get?
    desired_bank_buffer = 30 * 60 * CM.Strategy.trueCpS * buff_mult / 0.15;
    ratio_of_desired_buffer = Math.min(1, Game.cookies / desired_bank_buffer);
  }

  // Can't cast HofF if we don't have enough magic
  grimoire = Game.Objects["Wizard tower"].minigame;
  if (grimoire.magicM < 21) // Hopefully magicM >= 8 so we can cast cbg
    return true;
  has_ruin = (Game.hasGod && Game.hasGod("ruin"))

  // Which is better: conjuring baked goods or forcing the hand of fate?
  ruin_mult = 1;
  if (has_ruin) {
    slot = has_ruin; // Game.hasGod returns which slot if it's in one
    ruin_factor = .01 * Math.pow(2, 1-slot);
    ruin_mult += ruin_factor * Game.Objects.Cursor.amount;
  }

  // Figure out cursor multiplier; could just add up number of "<X> mouse"
  // upgrades and multiply by .01, but this is easier.
  cursor_mult = Game.mouseCps()/Game.cookiesPs;

  // How much time will we have during a potential click frenzy?  If we cast
  // Force hand of Fate, it'll take about 3.5 seconds to find golden cookie
  // and pop it (remember: pretending to have human-like reaction time),
  // and another 1.5 seconds to see what the result is and whether action
  // needs to be taken, for a total of five seconds off of whatever overlapped
  // buff time we have.
  duration = Math.min(buff_time, Game.Has("Get lucky") ? 26 : 13) - 5;

  // Also, if we're using the spirit of ruin, 2 out of every 10 seconds used on
  // buying and selling buildings.  And we won't sell if there won't be enough
  // time left to make it worth it.
  if (has_ruin) {
    ruin_duration = 0;
    while (duration) {
      duration -= 2;
      if (duration <= 3)
        duration = 0;
      remainder = Math.min(8, duration);
      duration -= remainder;
      ruin_duration += remainder;
    }
    duration = ruin_duration;
  }

  // Let our caller know if conjure baked goods is better than hand of fate.
  return 1.83 * ratio_of_desired_buffer > ruin_mult * cursor_mult * duration;
}

CM.Strategy.conjureBakedGoods = function() {
  desired_bank_buffer = 30 * 60 * Game.cookiesPs / 0.15;
  percentage_of_wanted = Math.min(100, 100 * Game.cookies / desired_bank_buffer);

  console.log(`Cast Conjure Baked Goods ` +
              `during x${CM.Strategy.currentBuff} buff ` +
              `with ${percentage_of_wanted.toFixed(0)}% of bank ` +
              `at ${Date().toString()}`)
  cbg = Game.Objects["Wizard tower"].minigame.spells["conjure baked goods"];
  Game.Objects["Wizard tower"].minigame.castSpell(cbg);
}

CM.Strategy.handleSpellsDuringBuffs = function() {
  // Exit early if we can't cast spells
  grimoire = Game.Objects["Wizard tower"].minigame
  if (!grimoire)
    return;

  // Recompute the buffs (after popping GC) as we use that info here.
  CM.Strategy.recomputeBuffs();

  // Exit early if there aren't any buffs, if there aren't enough buffs to be
  // worth our while, if the buffs will end to soon, or if our odds of getting
  // a successful spell cast are too low.
  if (CM.Strategy.currentNumBuffs < 1)
    return;
  if (Game.Has("Get lucky") && CM.Strategy.currentNumBuffs < 2)
    return;
  if (CM.Strategy.currentBuffTimeLeft < Math.PI+2*Math.E) // *shrug*
    return;
  if (Game.buffs["Magic inept"])
    return;

  if (CM.Strategy.cbg_better_than_fhof(0)) {
    //if ((grimoire.magic >= 8 && selling) || (grimoire.magic >= 13)) {
    // FIXME: Add strategy to use when selling wizard towers; it could be
    // even faster.
    if (grimoire.magic >= 14 ||
        (grimoire.magic >= 13 && CM.Strategy.currentBuffTimeLeft >= 72)) {
      // First, cast diminish ineptitude.  Well, unless there's already a
      // leftover diminish ineptitude from before.
      time_left = CM.Strategy.currentBuffTimeLeft;
      if (!Game.buffs["Magic adept"]) {
        grimoire.castSpell(grimoire.spells["diminish ineptitude"])
      } else {
        time_left = Math.min(time_left, Game.buffs["Magic adept"].time/Game.fps);
      }

      // Next, setup a timeout to cast Conjure Baked Goods
      if (Game.buffs["Magic adept"]) {
        maxWait = 1000*(time_left-5);
        minWait = 1000*Math.max(.5, time_left-10);
        if (grimoire.magic < 14)
          minWait = 66000;
        setTimeout(CM.Strategy.conjureBakedGoods,
                   CM.Strategy.Interval(minWait, maxWait))
      } else {
        console.log(`Diminish ineptitude failed; not trying to CBG at ${Date().toString()}`);
      }
    }
  } else {
    if (grimoire.magic >= 23) {
      // Cast the hand of fate, and trigger a timeout to act on it
      grimoire.castSpell(grimoire.spells["hand of fate"])
      CM.Strategy.logHandOfFateCookie = true;
      setTimeout(CM.Strategy.shimmerAct, CM.Strategy.Interval(3000, 4000))
    }
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
  if (!CM.Strategy.clickInterval && CM.Strategy.clickingNeeded()) {
    console.log(`Mouse click multiplier buff detected at ${Date().toString()}`);
    CM.Strategy.clickInterval = setInterval(CM.Strategy.doClicking, 100);
  }

  // Otherwise, check to see if we want to take advantage of some spell
  // casting
  else
    CM.Strategy.handleSpellsDuringBuffs();
}

CM.Strategy.popOne = function() {
  if (Date.now() - CM.Strategy.timer.lastPop > 1000) {
    Game.shimmers.some(function(shimmer) {
      if (shimmer.type !== 'golden' || shimmer.wrath === 0) {
        shimmer.pop();
        CM.Strategy.timer.lastPop = Date.now();
        var [minw, maxw] = [1000, 2000];
        if (Game.shimmerTypes.golden.last === 'chain cookie')
          [minw, maxw] = [4500, 5750];
        setTimeout(CM.Strategy.shimmerAct, CM.Strategy.Interval(minw, maxw));
        if (CM.Strategy.logHandOfFateCookie) {
          CM.Strategy.logHandOfFateCookie = false;
          console.log(`Hand of Fate resulted in ` +
                      `${Game.shimmerTypes.golden.last} golden cookie ` +
                      `during x${CM.Strategy.currentBuff} buff ` +
                      `at ${Date().toString()}`)
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
      pp = Game.Upgrades[item].getPrice() / (special_factor * cps);
    } else {
      pp = CM.Cache.Upgrades[item].pp * CM.Strategy.currentBuff;
    }
  } else if (CM.Cache.Objects[item]) {
    bsf = CM.Strategy.building_special_factor;
    bs_pp = Math.max(0, Game.Objects[item].getPrice()-Game.cookies) / cps +
            Game.Objects[item].getPrice() / (bsf * cps)
    pp = Math.min(CM.Cache.Objects[item].pp * CM.Strategy.currentBuff, bs_pp);
}

  // Return what we found
  return pp;
}

CM.Strategy.getCheapItem = function(item, price) {
  // pp == Projected Payoff, mostly calculated by CookieMonster.  We're not
  // actually calculating PP here, just returning a random small value if an
  // item is considered cheap enough.  Basically, I don't want upgrades to
  // sit around forever, and once buildings become cheap enough it's cool
  // to just buy more.
  pp = Number.MAX_VALUE;
  cps = CM.Strategy.trueCpS;
  if (price < 1*cps)
    return 3.1415926535897932384626433832795; // arbitrary small number

  // Return what we found
  return pp;
}

CM.Strategy.itemLimitsForMinigames = function(item, price) {
  // FIXME: It's probably some factor times trueCpS, not simply 1*trueCpS
  if (item === "Cursor" && Game.hasGod && Game.hasGod("ruin") &&
      Game.Objects.Mine.amount >= 5 && price > 1*CM.Strategy.trueCpS)
    return Number.MAX_VALUE;
  else if (item === "Wizard tower" && Game.Objects["Wizard tower"].minigame &&
           Game.Objects.Portal.amount >= 5)
    return Number.MAX_VALUE;
  return 0;
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
    pp = Math.max(pp, CM.Strategy.itemLimitsForMinigames(item, price));
    if (pp < lowestPP) {
      lowestPP = pp;
      best = {name: item, price: price, pp: pp, obj: Game.Objects[item]}
    } //else { console.log(`Skipping ${item}; not better PP`) }
  }
  return best
}

CM.Strategy.expectedTimeUntil = function(gcevent) {
  // Get information about how often cookies appear
  mint = Game.shimmerTypes.golden.minTime/Game.fps;
  maxt = Game.shimmerTypes.golden.maxTime/Game.fps;
  used = Game.shimmerTypes.golden.time/Game.fps;

  // Rough estimate of how often they appear on average
  ave = 0.75*mint + 0.25*maxt;

  // Determine the last type that appeared
  map = {'frenzy': 'Frenzy', 'multiply cookies': 'Lucky'};
  lastType = map[Game.shimmerTypes.golden.last] || 'Other';

  // Expected time
  return ave * CM.Strategy.expected_factors[gcevent][lastType] -
         Math.min(used, ave);
}

CM.Strategy.reasonableCookiesBeforeGC = function() {
  // Also compute how much we are almost certain we can earn before we
  // get a golden cookie
  maxt = Game.shimmerTypes.golden.maxTime/Game.fps;
  used = Game.shimmerTypes.golden.time/Game.fps;
  min_reasonable_time_until_gc = Math.min(0, (5.0/12*maxt)-used);

  normal_cookies = min_reasonable_time_until_gc * CM.Strategy.trueCpS;
  buffed_cookies = CM.Strategy.currentBuff *
    Math.min(min_reasonable_time_until_gc, CM.Strategy.currentBuffTimeLeft);
  cookies_before_gc = Math.max(normal_cookies, buffed_cookies);

  return cookies_before_gc;
}

CM.Strategy.timeUntilMagicFill = function(desired_level) {
  grimoire = Game.Objects["Wizard tower"].minigame

  // A human being only knows the floor of our actual magic.  So act like
  // that's all we know
  cur_magic = Math.floor(grimoire.magic);
  max_magic = grimoire.magicM;
  if (!desired_level)
    desired_level = grimoire.magicM;

  // If we already have enough, wait time is zero.
  if (grimoire.magic >= desired_level)
    return 0;

  // Solution to continuous integral approximation of the actual discrete
  // integral formula used to calculate magic does a really good job of
  // pegging exactly how much time we need -- well, assuming that "cur_magic"
  // is actually close, that is.
  return 100.0 / 3 * Math.sqrt(Math.max(100,max_magic)) *
         (Math.sqrt(max_magic) - Math.sqrt(cur_magic));
}

CM.Strategy.determineBankBuffer = function(item_pp) {
  // Special case getting started
  if (Game.cookiesPs === 0)
    return 0;

  // Do golden cookies overlap?  Is the Grimoire minigame in play?
  gc_overlap = Game.Upgrades["Get lucky"].bought
  grimoire = Game.Objects["Wizard tower"].minigame &&
             Game.Objects["Wizard tower"].amount >= 8; // # needed for CBG

  // What's our reasonable minimum production before the next Golden Cookie
  // appears?
  var cookies_before_gc = CM.Strategy.reasonableCookiesBeforeGC();
  var expected_time;
  var factor = 23/3;

  // Make sure we have enough bank buffer to take optimal advantage of
  // "Lucky" golden cookies, including relevant multipliers.
  if (!gc_overlap) {
    if (grimoire) {
      expected_time = CM.Strategy.timeUntilMagicFill() +
                      CM.Strategy.expectedTimeUntil("Frenzy");
      if (item_pp > factor*expected_time) {
        if (CM.Strategy.cbg_better_than_fhof(1))
          return 2*CM.Cache.LuckyFrenzy - cookies_before_gc;
        else
          return CM.Cache.LuckyFrenzy - cookies_before_gc;
      }
    }
    expected_time = CM.Strategy.expectedTimeUntil("Lucky");
    if (item_pp > factor*expected_time)
      return CM.Cache.Lucky - cookies_before_gc;
    return 0
  } else {
    if (grimoire) {
      expected_time = CM.Strategy.timeUntilMagicFill() +
                      CM.Strategy.expectedTimeUntil("FrenzyXDHoBS");
      if (item_pp > factor*expected_time) {
        if (CM.Strategy.cbg_better_than_fhof(1))
          return 30*CM.Cache.LuckyFrenzy - cookies_before_gc;
        else
          return 15*CM.Cache.LuckyFrenzy - cookies_before_gc;
      }
    }
    if (item_pp > factor * CM.Strategy.expectedTimeUntil("FrenzyXLucky"))
      return CM.Cache.LuckyFrenzy - cookies_before_gc;
    if (item_pp > factor * CM.Strategy.expectedTimeUntil("Lucky"))
      return CM.Cache.Lucky - cookies_before_gc;
    return 0;
  }
}

CM.Strategy.handlePurchases = function() {
  // Don't run this function too often, even if stats are updated more
  // frequently (see CM.Config.UpStats and CM.ConfigData.UpStats)
  if (Date.now() - CM.Strategy.timer.lastPurchaseCheck < 5000)
    return;
  CM.Strategy.timer.lastPurchaseCheck = Date.now();

  // Don't buy upgrades or buildings while in a clickfest
  if (CM.Strategy.clickInterval)
    return;

  // Set a small factor to help with building purchase decisions
  CM.Strategy.building_special_factor = 0.000058;
  if (Game.Has('Lucky day')) CM.Strategy.building_special_factor = 0.00011;
  if (Game.Has('Serendipity')) CM.Strategy.building_special_factor = 0.00021;
  if (Game.Has('Get lucky')) CM.Strategy.building_special_factor = 0.0009;

  // Find out what to purchase
  log_purchase_for_user = true;
  bestBuy = CM.Strategy.determineBestBuy(CM.Strategy.getTruePP);
  bestBuffer = CM.Strategy.determineBankBuffer(bestBuy.pp);

  // If we don't have enough to buy the best item, check for super cheap items
  if (CM.Cache.lastCookies < bestBuffer + bestBuy.price) {
    bestBuy = CM.Strategy.determineBestBuy(CM.Strategy.getCheapItem);
    // bestBuy could be {} here
    if (bestBuy.name)
      bestBuffer = 0;
  }

  // Don't log the purchase for the user if we're just buying back what we
  // already had before
  if (Game.resets > CM.Strategy.lastResets) {
    CM.Strategy.lastResets = Game.resets
    for (bldg in Game.Objects)
      CM.Strategy.buildingMax[bldg] = Game.Objects[bldg].amount;
  } else if (Game.Objects[bestBuy.name] &&
             CM.Strategy.buildingMax[bestBuy.name] >
             Game.Objects[bestBuy.name].amount) {
    log_purchase_for_user = false;
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
    if (log_purchase_for_user)
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

  // Record the new maximum number of buildings (which could have changed due
  // to the user buying since we last ran or by our purchasing above)
  for (bldg in Game.Objects)
    CM.Strategy.buildingMax[bldg] = Math.max(
      CM.Strategy.buildingMax[bldg], Game.Objects[bldg].amount);
}

CM.Strategy.recomputeBuffs = function() {
  // Determine various information about the current buffs going on:
  // their combined multiplier, how many there are, and how long they'll
  // continue running for
  CM.Strategy.currentBuff = 1;
  CM.Strategy.currentNumBuffs = 0; // Normal only, not click buffs
  CM.Strategy.currentBuffTimeLeft = 0;
  CM.Strategy.currentClickBuff = 1;
  CM.Strategy.currentClickBuffTimeLeft = 0;
  maxDur = Number.MAX_VALUE;
  minClickDur = 0;
  Object.keys(Game.buffs).forEach(name => {
    if (Game.buffs[name].multCpS) {
      CM.Strategy.currentBuff *= Game.buffs[name].multCpS;
      maxDur = Math.min(maxDur, Game.buffs[name].time/Game.fps);
      CM.Strategy.currentNumBuffs += (Game.buffs[name].multCpS > 1) ? 1 : -1;
    }
    if (Game.buffs[name].multClick && name !== 'Devastation') {
      CM.Strategy.currentClickBuff *= Game.buffs[name].multClick;
      minClickDur = Math.max(minClickDur, Game.buffs[name].time/Game.fps);
    }
  });
  CM.Strategy.currentBuffTimeLeft = maxDur;
  CM.Strategy.currentClickBuffTimeLeft = minClickDur;

  // Determine the trueCpS (i.e. cookies/second), not temporary CpS going on now
  CM.Strategy.trueCpS = Game.cookiesPs / CM.Strategy.currentBuff;
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
  CM.Strategy.oldRemakePP();

  CM.Strategy.recomputeBuffs();
  CM.Strategy.handlePurchases();
}
