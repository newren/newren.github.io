// autoplay.js: An extension to make Cookie Clicker more like IdleRPG
//
// This extension models a human-like player with below average reaction
// time and speed.  It basically does just a few things, all configurable:
//   * Makes purchases (max of 1 purchase per five seconds)
//   * Clicks on golden cookies and reindeer (after human-like delay)
//   * Clicks on the big cookie during ClickFrenzies/DragonFlights
//     (5 or so times per second, after human like delay)
//   * Will cast a few spells from the Grimoire minigame when conditions
//     are right
//   * Moves Cyclius into and out of the lower value slots in the Pantheon
//     minigame, if those slots are free.  [Not yet configurable]
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
//   * It won't select most spirits for the Pantheon minigame
//   * It won't cast most spells from the Grimoire minigame
//   * It won't spend sugar lumps for anything
//   * It only collects achievements for things related to normal operations
//     (buying buildings, clicking on golden cookies, maybe an occasional
//      spell); special achievements (renaming the bakery, dunking the big
//      cookie, etc.) are for a real human to collect
//
// Most of the things it doesn't do are things you probably would only want to
// do rather infrequently, thus this extension mostly removes the motivation
// to frequently check on the game and makes it more of an infrequent check-up
// and tweaking.  Just the way I like it.

/*** License blurb ***/

// The MIT License (MIT)
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/*** Overall Variables ***/

AP = {};
AP.Options = {}

/*** Big Cookie clicking related functions ***/

AP.clickingNeeded = function() {
  return AP.currentClickBuff > 1 && AP.Config.BigCookieClicks == 1;
}

AP.clearClickInterval = function() {
  clearInterval(AP.clickInterval);
  AP.clickInterval = undefined;
  // Make there be a good gap between a clicking frenzy and any purchase
  // automatically made afterward.
  AP.timer.lastPurchaseCheck = Date.now() + 5000;
}

AP.doClicking = function() {
  // Recompute the buffs as we use that info in some of our sub-functions
  // (mostly just to see if there's still a clicking buff or whether there's
  // enough time left in it to do more spiritOfRuinActions)
  AP.recomputeBuffs();

  // Check if we can boost our click power by buying and selling buildings
  if (AP.usage.spiritOfRuin == 2 && AP.spiritOfRuinActions()) {
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

    // If clicking is no longer needed, we need to wrap things up.  Except
    // that we sometimes like to click a few extra times after the buff ends,
    // to mimic how a human would behave.
    if (!AP.clickingNeeded() && Math.random() < 1/3) {
      if (AP.usage.spiritOfRuin < 2)
        AP.clearClickInterval();
      else
        AP.spiritOfRuinTimeToBuyBack = true;
    }
  }
}

/*** Shimmer-related functions ***/

AP.shimmerAct = function() {
  // ShimmerAppeared() won't be called after the initiating cookie for
  // either cookie chains and cookie Storms, so we need to check if there
  // are more cookies manually here.
  if (Game.shimmers.length)
    AP.popOne();

  // After a golden cookie is clicked, check to see if it was one that
  // needs lots of clicking on the big cookie
  if (!AP.clickInterval && AP.clickingNeeded()) {
    console.log(`Mouse click multiplier buff detected at ${Date().toString()}`);
    AP.clickInterval = setInterval(AP.doClicking, 100);
  }

  // Otherwise, check to see if we want to take advantage of some spell
  // casting
  else if (AP.Config.GrimoireSpellcasting)
    AP.handleSpellsDuringBuffs();
}

AP.popOne = function() {
  if (Date.now() - AP.timer.lastPop > 1000) {
    Game.shimmers.some(function(shimmer) {
      if (shimmer.type !== 'golden' || shimmer.wrath === 0 ||
          AP.Config.ShimmerTypes == 2) {  // FIXME, Maybe not the unlucky wraths from Force Hand of Fate?
        shimmer.pop();
        AP.timer.lastPop = Date.now();
        var [minw, maxw] = [1000, 2000];
        if (Game.shimmerTypes.golden.last === 'chain cookie')
          [minw, maxw] = [4500, 5750];
        setTimeout(AP.shimmerAct, AP.Interval(minw, maxw));
        if (AP.logHandOfFateCookie) {
          AP.logHandOfFateCookie = false;
          console.log(`Hand of Fate resulted in ` +
                      `${Game.shimmerTypes.golden.last} golden cookie ` +
                      `during x${AP.currentBuff} buff ` +
                      `at ${Date().toString()}`)
        }
        return true;
      }
      else if (AP.logHandOfFateCookie &&
               shimmer.type === 'golden' && shimmer.wrath) {
        AP.logHandOfFateCookie = false;
        console.log(`Hand of Fate resulted in wrath cookie at ` +
                    `${Date().toString()}`)
      }
    });
  } else if (Game.shimmers.length) {
    setTimeout(AP.popOne, 1000 - (Date.now() - AP.timer.lastPop))
  }
}

AP.ShimmerAppeared = function() {
  if (AP.Config.ShimmerClicking == 1) {
    min = 1000 * (1 + Game.shimmers[Game.shimmers.length-1].dur / 12);
    max = min + 4000;
  } else if (AP.Config.ShimmerClicking == 2) {
    min = 1000 * (1 + Game.shimmers[Game.shimmers.length-1].dur / 12);
    max = 1000 * (1 + Game.shimmers[Game.shimmers.length-1].life / Game.fps);
  }
  setTimeout(AP.popOne, AP.Interval(min, max))
}

/*** Pantheon actions ***/

AP.spiritOfRuinActions = function(preclick) {
  action_taken = true;

  // When the buff ends, we need to finish our last few unbuffed clicks before
  // buying back the buildings
  if (!AP.clickingNeeded() && !AP.spiritOfRuinTimeToBuyBack)
    return !action_taken;

  // If the buff ends for needing to click, and we've bought back our cursors,
  // we don't bother taking any further action.
  if (!AP.clickingNeeded() &&
      Game.Objects.Cursor.amount >= AP.spiritOfRuinPreviousCursors) {
    AP.spiritOfRuinDelayTokens = 0;
    AP.spiritOfRuinDelayBeforeBuying = false;
    AP.spiritOfRuinPreviousCursors = 0;
    AP.spiritOfRuinTimeToBuyBack = false;
    AP.clearClickInterval();
    return action_taken;
  }

  // Whenever we previously took an action, we need to delay a bit before
  // taking another, to mimic how a real human would behave.
  if (AP.spiritOfRuinDelayTokens > 0) {
    AP.spiritOfRuinDelayTokens -= 1;
    // Technically we didn't take an action, but we pretend we did because
    // we don't want clicking on the big cookie to happen during our
    // "delay before next action"
    return action_taken;
  }

  // If clicking is over, buy back whatever cursors we had
  if (!AP.clickingNeeded()) {
    // Determine how many to buy at a time, and do so
    num = AP.spiritOfRuinPreviousCursors - Game.Objects.Cursor.amount;
    num = (num >= 100) ? 100 : ((num >= 10) ? 10 : 1);
    AP.buyBuilding('Cursor', num);

    // Add a slight delay before buying more
    AP.spiritOfRuinDelayTokens = AP.Interval(1, 3);
    return action_taken;
  }

  // If pantheon minigame available and spirit of ruin selected and we don't
  // already have a buff from the spirit of ruin
  pantheon = Game.Objects["Temple"].minigame;
  if (pantheon && Game.hasGod("ruin") && !Game.buffs["Devastation"]) {

    // Determine if we need to buy more cursors
    base_cursor_cost = Game.Objects.Cursor.getPrice();
    cursor_cost = AP.costToPurchase(100, base_cursor_cost);
    if (cursor_cost < AP.trueCpS) {

      // We should not buy immediately after a Devastation buff ends; there
      // should be some kind of natural delay.
      if (AP.spiritOfRuinDelayBeforeBuying) {
        AP.spiritOfRuinDelayBeforeBuying = false;
        AP.spiritOfRuinDelayTokens = AP.Interval(5, 7);
        return action_taken;
      }

      // Buy cursors!
      AP.buyBuilding('Cursor', 100);
      AP.spiritOfRuinDelayTokens = AP.Interval(1, 3);
      return action_taken;

    } else if (Game.Objects.Cursor.amount &&
               AP.currentClickBuffTimeLeft > 3) {
      // Sell cursors!
      if (AP.spiritOfRuinPreviousCursors == 0)
        AP.spiritOfRuinPreviousCursors = Game.Objects.Cursor.amount;
      AP.sellBuilding('Cursor', -1);
      AP.spiritOfRuinDelayTokens = AP.Interval(4, 6);
      AP.spiritOfRuinDelayBeforeBuying = true;
      return action_taken;
    }
  }

  // We didn't do anything, let caller know they can click the big cookie
  return !action_taken;
}

AP.adjustPantheon = function() {
  pantheon_adjusted = true;

  pantheon = Game.Objects.Temple.minigame
  if (pantheon.swaps == 3) {
    // Determine where we want this spirit
    value = Math.floor((Date.now() % 86400000) / 7200000)

    cyclius = pantheon.gods["ages"].id
    slot1available = (pantheon.slot[1] == -1) || (pantheon.slot[1] == cyclius)
    slot2available = (pantheon.slot[2] == -1) || (pantheon.slot[2] == cyclius)

    desiredSlot = false;
    if (value <= 1 && slot1available && slot2available)
      desiredSlot = 2
    else if (value % 6 <= 2 && slot1available)
      desiredSlot = 2
    else if (value <= 5 && slot2available)
      desiredSlot = 3

    // Exit if we don't have him and don't want him.
    if (!desiredSlot && !Game.hasGod('ages'))
      return !pantheon_adjusted;

    // Put Cyclius into the desired slot, if not already there
    if (Game.hasGod('ages') != desiredSlot) {
      pantheon.dragGod(pantheon.gods.ages);
      // slots used are 0-2, even though hasGod returns 1-3.
      // Also, kinda lame to get -1 from "false-1", but it works...
      pantheon.hoverSlot(desiredSlot-1);
      pantheon.dropGod();
      console.log(`Moved Cyclius into slot ${desiredSlot} `+
                  `at ${Date().toString()}`)
      return pantheon_adjusted;
    }
  }

  return !pantheon_adjusted;
}

/*** Spell-casting ***/

AP.cbg_better_than_fhof = function(just_determining_bank_buffer) {
  // Exit early if big cookie clicks aren't wanted.  The whole point of
  // Force Hand Of Fate is to try to get click frenzies, which are only
  // useful if we're doing auto-clicking.  So if the user doesn't want us
  // auto-clicking, Conjure Baked Goods is always better.
  if (AP.Config.BigCookieClicks == 0)
    return true;

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
    buff_time = AP.currentBuffTimeLeft;
    buff_mult = AP.currentBuff;

    // If we were to cast conjure baked goods, what percentage of the optimal
    // number of cookies could we hope to get?
    desired_bank_buffer = 30 * 60 * AP.trueCpS * buff_mult / 0.15;
    ratio_of_desired_buffer = Math.min(1, Game.cookies / desired_bank_buffer);
  }

  // Can't cast HofF if we don't have enough magic
  if (AP.buildingMax["Wizard tower"] < 21)
    return true;
  has_ruin = (Game.hasGod && Game.hasGod("ruin"))

  // Which is better: conjuring baked goods or forcing the hand of fate?
  ruin_mult = 1;
  if (has_ruin && AP.usage.spiritOfRuin == 2) {
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

AP.conjureBakedGoods = function() {
  desired_bank_buffer = 30 * 60 * Game.cookiesPs / 0.15;
  percentage_of_wanted = Math.min(100, 100 * Game.cookies / desired_bank_buffer);

  console.log(`Cast Conjure Baked Goods ` +
              `during x${AP.currentBuff} buff ` +
              `with ${percentage_of_wanted.toFixed(0)}% of bank ` +
              `at ${Date().toString()}`)
  cbg = Game.Objects["Wizard tower"].minigame.spells["conjure baked goods"];
  Game.Objects["Wizard tower"].minigame.castSpell(cbg);
}

AP.handleSpellsDuringBuffs = function() {
  // Exit early if we can't cast spells
  grimoire = Game.Objects["Wizard tower"].minigame
  if (!grimoire)
    return;

  // Recompute the buffs (after popping GC) as we use that info here.
  AP.recomputeBuffs();

  // Exit early if there aren't any buffs, if there aren't enough buffs to be
  // worth our while, if the buffs will end to soon, or if our odds of getting
  // a successful spell cast are too low.
  if (AP.currentNumBuffs < 1)
    return;
  if (Game.Has("Get lucky") && AP.currentNumBuffs < 2)
    return;
  if (AP.currentBuffTimeLeft < Math.PI+2*Math.E) // *shrug*
    return;
  if (Game.buffs["Magic inept"])
    return;

  if (AP.cbg_better_than_fhof(0)) {
    // Do we have enough to cast diminish ineptitude and conjure baked goods?
    // FIXME: Add strategy to use when selling wizard towers; it could be
    //        even faster and should be able to do it with just 8 magic.
    if (grimoire.magicM < 13)
      return;
    if (grimoire.magicM == 13 &&
        (grimoire.magic != 13 || AP.currentBuffTimeLeft < 72))
      return;
    if (grimoire.magicM >= 14 &&
        grimoire.magic < Math.floor(0.6 * grimoire.magicM) + 7)
      return;

    // First, cast diminish ineptitude.  Well, unless there's already a
    // leftover diminish ineptitude from before.
    time_left = AP.currentBuffTimeLeft;
    if (!Game.buffs["Magic adept"]) {
      grimoire.castSpell(grimoire.spells["diminish ineptitude"])
    } else {
      time_left = Math.max(time_left, Game.buffs["Magic adept"].time/Game.fps);
    }

    // If it failed, exit with a message
    if (!Game.buffs["Magic adept"]) {
      console.log(`Diminish ineptitude failed; not trying to CBG at ${Date().toString()}`);
      return;
    }

    // Next, setup a timeout to cast Conjure Baked Goods
    maxWait = 1000*(time_left-5);
    minWait = 1000*Math.max(.5, time_left-10);
    if (grimoire.magic < 14)
      minWait = 66000;
    setTimeout(AP.conjureBakedGoods, AP.Interval(minWait, maxWait));

  } else {
    // Do we have enough to cast hand of fate?
    if (grimoire.magic < Math.floor(0.6 * grimoire.magicM) + 10)
      return;

    // Cast the hand of fate, and trigger a timeout to act on it
    grimoire.castSpell(grimoire.spells["hand of fate"])
    AP.logHandOfFateCookie = true;
    setTimeout(AP.shimmerAct, AP.Interval(3000, 4000))
  }
}

AP.adjustTowers = function() {
  action_taken = true;

  if (AP.usage.grimoire != 2)
    return !action_taken;

  if (AP.clickingNeeded()) {
    // If a GC comes and a click frenzy occurs while we're adjusting towers,
    // just bail and do the click frenzy.  We can get back to the towers
    // later.
    clearInterval(AP.towerInterval);
    AP.towerInterval = undefined;
    return !action_taken;
  }

  towers = Game.Objects["Wizard tower"];
  grimoire = towers.minigame;

  // If we buy/sell towers too quickly, that doesn't seem very human like.  We
  // can sell quickly if magicM is enough bigger than magic, but we need to
  // slow down when we get close.
  if (AP.towerInterval) {
    delay = (grimoire.magicM - Math.floor(grimoire.magic) >= 3) ? 3 : 1;
    if (Math.random() > 1/delay)
      return action_taken;
  }

  // Determine whether we need to buy or sell towers, or if we're all done
  if (grimoire.magicM == grimoire.magic && towers.getPrice() < 1*AP.trueCpS) {
    AP.buyBuilding('Wizard tower', 1);
    return action_taken;
  } else if (grimoire.magicM > grimoire.magic + 1 && towers.amount > 2) {
    amount = 1;
    if (grimoire.magicM > grimoire.magic + 11 && towers.amount > 12)
      amount = 10;
    AP.sellBuilding('Wizard tower', amount);
    return action_taken;
  } else if (AP.towerInterval) {
    // Magic now in the right range; remove the callback
    clearInterval(AP.towerInterval);
    AP.towerInterval = undefined;
    // Don't purchase other buildings immediately after trying to
    // adjust towers; make sure to wait at least a little bit.
    AP.timer.lastPurchaseCheck = Date.now() + 2500;
  }

  return !action_taken;
}

/*** Figuring out expected time ***/

AP.expectedTimeUntil = function(gcevent) {
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
  return ave * AP.expected_factors[gcevent][lastType] -
         Math.min(used, ave);
}

AP.reasonableCookiesBeforeGC = function() {
  // Also compute how much we are almost certain we can earn before we
  // get a golden cookie
  maxt = Game.shimmerTypes.golden.maxTime/Game.fps;
  used = Game.shimmerTypes.golden.time/Game.fps;
  min_reasonable_time_until_gc = Math.min(0, (5.0/12*maxt)-used);

  normal_cookies = min_reasonable_time_until_gc * AP.trueCpS;
  buffed_cookies = AP.currentBuff *
    Math.min(min_reasonable_time_until_gc, AP.currentBuffTimeLeft);
  cookies_before_gc = Math.max(normal_cookies, buffed_cookies);

  return cookies_before_gc;
}

AP.timeUntilMagicFill = function(desired_level) {
  grimoire = Game.Objects["Wizard tower"].minigame

  // A human being only knows the floor of our actual magic.  So act like
  // that's all we know
  cur_magic = Math.floor(grimoire.magic);
  max_magic = grimoire.magicM;
  if (!desired_level)
    desired_level = grimoire.magicM;

  // Never cast spells if Diminish Ineptitude backfired and the backfire is
  // still active.
  inept_time = 0;
  if (Game.buffs["Magic inept"])
    inept_time = Game.buffs["Magic inept"].time/Game.fps;

  // If we already have enough, wait time is zero.
  if (grimoire.magic >= desired_level)
    return inept_time;

  // Solution to continuous integral approximation of the actual discrete
  // integral formula used to calculate magic does a really good job of
  // pegging exactly how much time we need -- well, assuming that "cur_magic"
  // is actually close, that is.
  fill_time = 100.0 / 3 * Math.sqrt(Math.max(100,max_magic)) *
              (Math.sqrt(max_magic) - Math.sqrt(cur_magic));

  return Math.max(inept_time, fill_time);
}

/*** Purchasing related functions ***/

AP.costToPurchase = function(count, base_price) {
  cost_factor = (Math.pow(1.15,count) - 1) / (1.15 - 1);
  return cost_factor * base_price;
}

AP.buyBuilding = function(bldg, num) {
  [oldMode, Game.buyMode] = [Game.buyMode, 1];
  Game.Objects[bldg].buy(num);
  Game.buyMode = oldMode;
  Game.Objects[bldg].refresh();
}

AP.sellBuilding = function(bldg, num) { // Use num == -1 to sell all
  // Unlike .buy(), sell() is more sane; it doesn't look at buyMode to
  // decide whether to invert the meaning and switch between buying and
  // selling behind the user's back, so no need to temporarily toggle
  // Game.buyMode.  Yaay.
  Game.Objects[bldg].sell(num);
  Game.Objects[bldg].refresh();
}

AP.getSpontaneousEdificeBonus = function(item, price) {
  if (!AP.Config.GrimoireSpellcasting)
    return 0;

  M = 0;
  sum = 0;
  for (var bldg in Game.Objects)
    if (bldg != item && Game.Objects[bldg].amount < 400) {
      sum += Game.Objects[bldg].getPrice();
      M += 1;
    }
  if (Game.Objects[item].amount >= 400) {
    if (M == 0)
      return 0
    else
      se_bonus = - 0.00000043485 * price;
  } else if (Game.Objects[item].amount < 399) {
    se_bonus = (0.0000425/(M+1) - 0.00000043485) * price;
  } else { // Game.Objects[item].amount == 399
    se_bonus = 0.00028333*(1/M - 1/(M+1)) * sum
               - (0.00028333/(M+1) + 0.00000043485) * price;
  }
  return se_bonus;
}

AP.getTruePP = function(item, price) {
  // pp == Projected Payoff, mostly calculated by CookieMonster
  pp = Number.MAX_VALUE;
  if (CM.Cache.Upgrades[item]) {
    // Do a special computation of projected payoff for particular items that
    // CookieMonster simply returns Infinity for.
    special_factor = AP.specialPPfactor[item]
    if (special_factor) {
      if (!AP.Options.clickSomeShimmers())
        special_factor = Math.max(special_factor, 0.5);
      pp = Game.Upgrades[item].getPrice() / (special_factor * AP.trueCpS);
    } else {
      pp = CM.Cache.Upgrades[item].pp * AP.currentBuff;
    }
  } else if (CM.Cache.Objects[item]) {
    normal_bonus = CM.Cache.Objects[item].bonus / AP.currentBuff;
    if (AP.Options.clickSomeShimmers()) {
      bs_bonus = AP.building_special_factor * AP.trueCpS;
    } else {
      bs_bonus = 0;
    }
    se_bonus = AP.getSpontaneousEdificeBonus(item, price);
    combined_bonus = normal_bonus + bs_bonus + se_bonus;
    pp = (Math.max(price - Game.cookies, 0) / Game.cookiesPs) +
         (price / combined_bonus);
  }

  // Return what we found
  return pp;
}

AP.getCheapItem = function(item, price) {
  // pp == Projected Payoff, mostly calculated by CookieMonster.  We're not
  // actually calculating PP here, just returning a random small value if an
  // item is considered cheap enough.  Basically, I don't want upgrades to
  // sit around forever, and once buildings become cheap enough it's cool
  // to just buy more.
  pp = Number.MAX_VALUE;
  if (price < 1*AP.trueCpS)
    pp = 3.1415926535897932384626433832795; // arbitrary small number

  // Return what we found
  return pp;
}

AP.itemLimitsForMinigames = function(item, price) {
  if (AP.usage.spiritOfRuin > 0 && item === "Cursor" &&
      Game.Objects.Cursor.amount >= 100 && price > 1*AP.trueCpS) {
    return Number.MAX_VALUE;
  } else if (AP.usage.grimoire > 0 && item === "Wizard tower") {
    if (AP.usage.grimoire == 2)
      // Only buy towers to increase magic (done elsewhere), not because of
      // cookie generation
      return Number.MAX_VALUE;
    // At this point, AP.usage.grimoire == 1
    if (Game.Objects["Wizard tower"].amount >= 55 && price > 1*AP.trueCpS)
      return Number.MAX_VALUE;
  }
  return 0;
}

AP.determineBestBuy = function(metric) {
  // First purchase is always a Cursor.  Also, when we haven't yet bought
  // anything, pp for all upgrades is NaN or Infinity, so we really do
  // need a special case here.
  if (Game.cookiesPs === 0 && AP.Options.purchaseBuildings()) {
    return {name: "Cursor", price: Game.Objects.Cursor.getPrice(),
            pp: CM.Cache.Objects.Cursor.pp, obj: Game.Objects.Cursor}
  }

  // Find the item with the lowest projected payoff
  lowestPP = Number.MAX_VALUE;
  best = {};
  if (AP.Options.purchaseUpgrades()) {
    for (item in CM.Cache.Upgrades) {
      if (Game.Upgrades[item].unlocked) {
        if (AP.upgradesToIgnore.indexOf(item) === -1) {
          price = Game.Upgrades[item].getPrice();
          pp = metric(item, price);
          if (pp < lowestPP) {
            lowestPP = pp;
            best = {name: item, price: price, pp: pp, obj: Game.Upgrades[item]}
          } //else { console.log(`Skipping ${item}; not better PP`) }
        } //else { console.log(`Skipping ${item}; in ignore list`) }
      } //else { console.log(`Skipping ${item}; not unlocked`) }
    }
  }
  if (AP.Options.purchaseBuildings()) {
    for (item in CM.Cache.Objects) {
      price = Game.Objects[item].getPrice();
      pp = metric(item, price);
      pp = Math.max(pp, AP.itemLimitsForMinigames(item, price));
      if (pp < lowestPP) {
        lowestPP = pp;
        best = {name: item, price: price, pp: pp, obj: Game.Objects[item]}
      } //else { console.log(`Skipping ${item}; not better PP`) }
    }
  }
  return best
}

AP.determinePatientBankBuffer = function(item_pp) {
  // Special case getting started
  if (Game.cookiesPs === 0)
    return 0;

  // Do golden cookies overlap?  Is the Grimoire minigame in play?
  gc_overlap = Game.Upgrades["Get lucky"].bought
  grimoire = Game.Objects["Wizard tower"].minigame &&
             AP.buildingMax["Wizard tower"] >= 8; // # needed for CBG

  // What's our reasonable minimum production before the next Golden Cookie
  // appears?
  var cookies_before_gc = AP.reasonableCookiesBeforeGC();
  var expected_time;
  var factor = 23/3;

  // Make sure we have enough bank buffer to take optimal advantage of
  // "Lucky" golden cookies, including relevant multipliers.
  if (!gc_overlap) {
    if (grimoire) {
      expected_time = AP.timeUntilMagicFill() + AP.expectedTimeUntil("Frenzy");
      if (item_pp > factor*expected_time) {
        if (AP.cbg_better_than_fhof(1))
          return 2*CM.Cache.LuckyFrenzy - cookies_before_gc;
        else
          return CM.Cache.LuckyFrenzy - cookies_before_gc;
      }
    }
    expected_time = AP.expectedTimeUntil("Lucky");
    if (item_pp > factor*expected_time)
      return CM.Cache.Lucky - cookies_before_gc;
    return 0
  } else {
    if (grimoire) {
      expected_time = AP.timeUntilMagicFill() +
                      AP.expectedTimeUntil("FrenzyXDHoBS");
      if (item_pp > factor*expected_time) {
        if (AP.cbg_better_than_fhof(1))
          return 30*CM.Cache.LuckyFrenzy - cookies_before_gc;
        else
          return 15*CM.Cache.LuckyFrenzy - cookies_before_gc;
      }
    }
    if (item_pp > factor * AP.expectedTimeUntil("FrenzyXLucky"))
      return CM.Cache.LuckyFrenzy - cookies_before_gc;
    if (item_pp > factor * AP.expectedTimeUntil("Lucky"))
      return CM.Cache.Lucky - cookies_before_gc;
    return 0;
  }
}

AP.determineBankBuffer = function(item_pp) {
  if (AP.Config.AutoPurchase == 1)
    return 0;
  else if (AP.Config.AutoPurchase == 2)
    // Save 5 minutes of CpS per log_100(CpS), technically maxing out at
    // 105 minutes (== 7*15), though it's really hard to hit that max
    return 300 * AP.trueCpS * Math.min(21, 0.5*Math.log10(AP.trueCpS))
  else if (AP.Config.AutoPurchase == 3)
    return AP.determinePatientBankBuffer(item_pp);

  console.error(`Invalid AP.Config.AutoPurchase value of ${AP.Config.AutoPurchase} in AP.determineBankBuffer`);
}

AP.handlePurchases = function() {
  // Don't run this function too often, even if stats are updated more
  // frequently (see CM.Config.UpStats and CM.ConfigData.UpStats)
  if (Date.now() - AP.timer.lastPurchaseCheck < 5000)
    return;
  AP.timer.lastPurchaseCheck = Date.now();

  // Don't buy upgrades or buildings while in a clickfest or adjusting towers
  if (AP.clickInterval || AP.towerInterval)
    return;

  // Set a small factor to help with building purchase decisions
  AP.building_special_factor = 0.000058;
  if (Game.Has('Lucky day')) AP.building_special_factor = 0.00011;
  if (Game.Has('Serendipity')) AP.building_special_factor = 0.00021;
  if (Game.Has('Get lucky')) AP.building_special_factor = 0.0009;

  // Find out what to purchase
  log_purchase_for_user = true;
  bestBuy = AP.determineBestBuy(AP.getTruePP);
  bestBuffer = AP.determineBankBuffer(bestBuy.pp);

  // If we don't have enough to buy the best item, check for super cheap items
  if (CM.Cache.lastCookies < bestBuffer + bestBuy.price) {
    bestBuy = AP.determineBestBuy(AP.getCheapItem);
    // bestBuy could be {} here
    if (bestBuy.name)
      bestBuffer = 0;
  }

  // Don't log the purchase for the user if we're just buying back what we
  // already had before
  if (Game.resets > AP.lastResets) {
    AP.lastResets = Game.resets
    for (bldg in Game.Objects)
      AP.buildingMax[bldg] = Game.Objects[bldg].amount;
  } else if (Game.Objects[bestBuy.name] &&
             AP.buildingMax[bestBuy.name] >
             Game.Objects[bestBuy.name].amount) {
    log_purchase_for_user = false;
  }

  // Purchase if we have enough
  if (bestBuy.price && CM.Cache.lastCookies >= bestBuffer + bestBuy.price) {

    // Determine if we should buy in bulk
    bulk_amount = 1;
    if (bestBuy.name in Game.Objects) {
      for (count of [10, 100]) {
        total_cost = AP.costToPurchase(count, bestBuy.price)
        if (total_cost < 5*AP.trueCpS && CM.Cache.lastCookies >= total_cost)
          bulk_amount = count;
      }
      AP.buyBuilding(bestBuy.name, bulk_amount);
    } else {
      bestBuy.obj.buy();
    }

    // Log what we're doing
    if (log_purchase_for_user)
      console.log(`Bought ${bulk_amount} ${bestBuy.name}(s) `+
                  `(with PP of ${CM.Disp.Beautify(bestBuy.pp)}) ` +
                  `at ${Date().toString()}`)
  } else if (AP.adjustTowers()) {
    // One adjustment usually isn't enough; make sure we keep adjusting until
    // it's up or down to the right value
    AP.towerInterval = setInterval(AP.adjustTowers, 200);
  } else if (AP.adjustPantheon()) {
    // guess there's not much to do here right now, but maybe there will be
    // in the future
  }

  // Record the new maximum number of buildings (which could have changed due
  // to the user buying since we last ran or by our purchasing above)
  for (bldg in Game.Objects)
    AP.buildingMax[bldg] = Math.max(
      AP.buildingMax[bldg], Game.Objects[bldg].amount);
}

/*** Code dealing with whether we should turn on "unusual" usage strategies **/

AP.checkUnusualUsageStrategies = function() {
  // AP.usage is for strategies that are either temporarily negative or are
  // outright negative in specific facets but which may have benefits that
  // outweigh the negatives, IF people aren't shocked/surprised and take
  // action that circumvents the strategies (an all too likely occurrence
  // that could exacerbate the negatives).  Even if they don't do anything
  // amiss, the surprise factor itself could be too much of a shock.  So don't
  // turn these on full unless it's clear the user wants them, and turn them
  // back off if they take steps that would make the negatives too big.

  if (Game.resets == 0)
    return;

  // Levels, for both spiritOfRuin and grimoire:
  //   2: Take full advantage; buy/sell/rebuy buildings with abandon
  //   1: Avoid buying too many of certain buildings so it won't be painful
  //      to employ the strategy later, but don't actually sell the buildings.
  //   0: Don't limit building purchases based on these strategies, and don't
  //      ever sell buildings for these either.
  if (Game.resets > 0 && Game.lastResets == 0) {
    AP.usage.spiritOfRuin = 1;
    AP.usage.grimoire =     1;
  }

  // First, handling of the spirit of ruin
  cursor_amount = Game.Objects.Cursor.amount
  if (Game.hasGod && Game.hasGod("ruin") && Game.Objects.Mine.amount >= 5) {
    if (Game.Objects.Cursor.getPrice() > 1.15*AP.trueCpS && cursor_amount > 100)
      AP.usage.spiritOfRuin = 0;
    if (cursor_amount == 0 && AP.buildingMax.Cursor > 100)
      AP.usage.spiritOfRuin = 2;
  }

  // Second, handling grimoire
  tower_amount = Game.Objects["Wizard tower"].amount
  if (AP.buildingMax["Wizard tower"] == 100 + tower_amount ||
      AP.buildingMax["Wizard tower"] == 200 + tower_amount)
    // We don't want Krumblor sacrifices to trigger this behavior.
    AP.buildingMax["Wizard tower"] = tower_amount
  grimoire = Game.Objects["Wizard tower"].minigame;
  if (grimoire && Game.Objects.Portal.amount >= 5) {
    if (Game.Objects["Wizard tower"].getPrice() > 1.15*AP.trueCpS &&
        tower_amount > 55)
      AP.usage.grimoire = 0;
    if (tower_amount < AP.buildingMax["Wizard tower"] - 1)
      AP.usage.grimoire = 2;
  }
}

/*** Miscellaneous functions ***/

AP.Interval = function(lower, upper) {
  return lower + (upper-lower)*Math.random();
}

AP.recomputeBuffs = function() {
  // Determine various information about the current buffs going on:
  // their combined multiplier, how many there are, and how long they'll
  // continue running for
  AP.currentBuff = 1;
  AP.currentNumBuffs = 0; // Normal only, not click buffs
  AP.currentBuffTimeLeft = 0;
  AP.currentClickBuff = 1;
  AP.currentClickBuffTimeLeft = 0;
  maxDur = Number.MAX_VALUE;
  minClickDur = 0;
  Object.keys(Game.buffs).forEach(name => {
    if (Game.buffs[name].multCpS) {
      AP.currentBuff *= Game.buffs[name].multCpS;
      maxDur = Math.min(maxDur, Game.buffs[name].time/Game.fps);
      AP.currentNumBuffs += (Game.buffs[name].multCpS > 1) ? 1 : -1;
    }
    if (Game.buffs[name].multClick && name !== 'Devastation') {
      AP.currentClickBuff *= Game.buffs[name].multClick;
      minClickDur = Math.max(minClickDur, Game.buffs[name].time/Game.fps);
    }
  });
  AP.currentBuffTimeLeft = maxDur;
  AP.currentClickBuffTimeLeft = minClickDur;

  // Determine the trueCpS (i.e. cookies/second), not temporary CpS going on now
  AP.trueCpS = Game.cookiesPs / AP.currentBuff;
}

/*** Configuration choices for the "Options" menu ***/

AP.ConfigInit = function() {

  AP.ConfigData = {}
  AP.Config = {}
  AP.ConfigPrefix = 'APConfig';

  AP.Config = { // See AP.ConfigData for meanings
    GlobalEnable: 0,
    AutoPurchaseTypes: 3,
    AutoPurchase: 3,
    BigCookieClicks: 1,
    ShimmerTypes: 1,
    ShimmerClicking: 1,
    GrimoireSpellcasting: 1,
  };
  AP.ConfigData.GlobalEnable = {
    label: ['Disabled',
            'Enabled'],
    desc: 'Whether AutoPlay is enabled; if not, options below are irrelevant'
    };
  AP.ConfigData.AutoPurchaseTypes = {
    label: ['None',
            'Just Buildings',
            'Just Upgrades & Research',
            'Buildings & Upgrades & Research'],
    desc: 'Types of purchases to automatically make',
    };
  AP.ConfigData.AutoPurchase = {
    label: ['Never',
            'As soon as I have enough money',
            'Leave a little buffer',
            'Patience, grasshopper'],
    desc: 'Automatic purchase timing for buildings and upgrades',
    };
  AP.ConfigData.BigCookieClicks = {
    label: ['Never',
            'Only during click specials'],
    desc: 'When to automatically click the big cookie',
    };
  AP.ConfigData.ShimmerTypes = {
    label: ["I'll click my own shimmers",
            'Not them wrath cookies!',
            'Click all the things!'],
    desc: 'Shimmer types (golden/wrath cookies, eggs, reindeer) to autoclick',
    };
  AP.ConfigData.ShimmerClicking = {
    label: ['Never',
            'When they show up',
            'Eh, whenever'],
    desc: 'When to autoclick shimmers (golden/wrath cookies, eggs, reindeer)',
    };
  AP.ConfigData.GrimoireSpellcasting = {
    label: ['Disable',
            'Enable'],
    desc: 'Automatically cast spells from the Grimoire minigame',
    };
}

AP.ToggleConfig = function(config) {
  AP.Config[config]++;
  if (AP.Config[config] == AP.ConfigData[config].label.length)
    AP.Config[config] = 0;
  l(AP.ConfigPrefix + config).innerHTML =
    AP.ConfigData[config].label[AP.Config[config]];
}

AP.AddMenuPref = function() {
  var new_menu = document.createDocumentFragment();
  var title = document.createElement('div');
  title.className = 'title ' + CM.Disp.colorTextPre + CM.Disp.colorBlue;
  title.textContent = 'Cookie Clicker AutoPlay';
  new_menu.appendChild(title);

  var listing = function(config) {
    var div = document.createElement('div');
    div.className = 'listing';
    var a = document.createElement('a');
    a.className = 'option';
    a.id = AP.ConfigPrefix + config;
    a.onclick = function() {AP.ToggleConfig(config);};
    a.textContent = AP.ConfigData[config].label[AP.Config[config]];
    div.appendChild(a);
    var label = document.createElement('label');
    label.textContent = AP.ConfigData[config].desc;
    div.appendChild(label);
    return div;
  }

  new_menu.appendChild(listing('GlobalEnable'));
  new_menu.appendChild(listing('AutoPurchaseTypes'));
  new_menu.appendChild(listing('AutoPurchase'));
  new_menu.appendChild(listing('BigCookieClicks'));
  new_menu.appendChild(listing('ShimmerTypes'));
  new_menu.appendChild(listing('ShimmerClicking'));
  new_menu.appendChild(listing('GrimoireSpellcasting'));

  l('menu').childNodes[2].insertBefore(new_menu, l('menu').childNodes[2].childNodes[l('menu').childNodes[2].childNodes.length - 1]);
}

AP.Options.doSomePurchases = function() {
  return AP.Config.GlobalEnable != 0 &&
    AP.Config.AutoPurchaseTypes != 0 && AP.Config.AutoPurchase != 0;
}

AP.Options.purchaseBuildings = function() {
  return AP.Config.GlobalEnable != 0 && (AP.Config.AutoPurchaseTypes & 1);
}

AP.Options.purchaseUpgrades = function() {
  return AP.Config.GlobalEnable != 0 && (AP.Config.AutoPurchaseTypes & 2);
}

AP.Options.clickSomeShimmers = function() {
  return AP.Config.GlobalEnable != 0 &&
    AP.Config.ShimmerTypes != 0 && AP.Config.ShimmerClicking != 0;
}

/*** Monkey patching and initialization ***/

AP.shimmerFunction = function(url) {
  // CM.Disp.PlaySound is called unconditionally, but then checks the options
  // to determine whether to actually play the sound, so even if the sound
  // option is off, we can use this to auto-click golden cookies.  :-)
  if (AP.Options.clickSomeShimmers())
    AP.ShimmerAppeared();
  AP.Backup.PlaySound(url);
}

AP.RemakePP = function() {
  AP.Backup.RemakePP();

  AP.recomputeBuffs();
  AP.checkUnusualUsageStrategies();
  if (AP.Options.doSomePurchases())
    AP.handlePurchases();
}

AP.NewUpdateMenu = function() {
  AP.Backup.UpdateMenu();
  if (Game.onMenu == 'prefs')
    AP.AddMenuPref();
}

AP.monkeyPatch = function() {
  AP.Backup.PlaySound = CM.Disp.PlaySound;
  CM.Disp.PlaySound = AP.shimmerFunction;

  AP.Backup.RemakePP = CM.Cache.RemakePP;
  CM.Cache.RemakePP = AP.RemakePP;

  AP.Backup.UpdateMenu = Game.UpdateMenu;
  Game.UpdateMenu = AP.NewUpdateMenu;
}

AP.SetSpecialConstants = function() {
  AP.specialPPfactor =
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
  AP.expected_factors = {  // Monte Carlo FTW
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
}

AP.Init = function() {
  AP.Backup = {};
  AP.timer = {};

  AP.timer.lastPop = Date.now();
  AP.timer.lastPurchaseCheck = Date.now();
  AP.buildingMax = {};
  AP.clickInterval = undefined;
  AP.towerInterval = undefined;
  AP.logHandOfFateCookie = false;
  AP.lastResets = Game.resets - 1;

  AP.usage = {};
  AP.usage.spiritOfRuin = (Game.resets > 0 ? 1 : 0);
  AP.usage.grimoire =     (Game.resets > 0 ? 1 : 0);

  AP.spiritOfRuinDelayTokens = 0;
  AP.spiritOfRuinDelayBeforeBuying = false;
  AP.spiritOfRuinPreviousCursors = 0;
  AP.spiritOfRuinTimeToBuyBack = false;

  AP.upgradesToIgnore = [
      "Golden switch [off]",
      "Golden switch [on]",
      "Golden cookie sound selector",
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
  AP.SetSpecialConstants();
  AP.recomputeBuffs();
  AP.ConfigInit();
  AP.monkeyPatch()

  Game.UpdateMenu(); // must come after AP.monkeyPatch()
}

AP.Init();
