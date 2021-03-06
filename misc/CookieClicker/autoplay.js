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
//   * Selects a subset of spirits to move into various slots in the
//     Pantheon.
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
//   * It won't cast most spells from the Grimoire minigame
//   * It will ignore about half the spirits, even though they all have
//     their uses in various special circumstances.
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
  return AP.currentClickBuff > 1 && AP.Config.Clicking.BigCookie == 1;
}

AP.clearClickInterval = function() {
  clearInterval(AP.clickInterval);
  AP.clickInterval = undefined;
  // Make there be a good gap between a clicking frenzy and any purchase
  // automatically made afterward.
  AP.timer.lastActionCheck = Date.now() + 5000;
}

AP.doClicking = function() {
  // Recompute the buffs as we use that info in some of our sub-functions
  // (mostly just to see if there's still a clicking buff or whether there's
  // enough time left in it to do more spiritOfRuinActions)
  AP.recomputeBuffs();

  // Check if we can boost our click power by buying and selling buildings
  if (AP.spiritOfRuinActions()) {
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
      if (!AP.Options.buffDevastation())
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
  else if (AP.Config.Minigames.SpellCasting)
    AP.handleSpellsDuringBuffs();
}

AP.popOne = function() {
  if (Date.now() - AP.timer.lastPop > 1000) {
    Game.shimmers.some(function(shimmer) {
      if (shimmer.type !== 'golden' || shimmer.wrath === 0 ||
          AP.Config.Clicking.ShimmerTypes == 2) {  // FIXME, Maybe not the unlucky wraths from Force Hand of Fate?

        // Move the mouse to the right position, then pop the shimmer
        r = shimmer.l.getBoundingClientRect();
        var [origx, origy] = [Game.mouseX, Game.mouseY];
        [Game.mouseX, Game.mouseY] = [r.left + r.width/2, r.top + r.height/2];
        shimmer.pop();
        [Game.mouseX, Game.mouseY] = [origx, origy];

        // Record the last pop time, so we don't pop too frequently like a
        // machine
        AP.timer.lastPop = Date.now();

        // Try to handle chain cookies, for which we won't get future
        // notifications
        var [minw, maxw] = [1000, 2000];
        if (Game.shimmerTypes.golden.last === 'chain cookie')
          [minw, maxw] = [4500, 5750];
        setTimeout(AP.shimmerAct, AP.Interval(minw, maxw));

        // Log results if this cookie was from a hand of fate
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
  if (AP.Config.Clicking.ShimmerWhen == 1) {
    min = 1000 * (1 + Game.shimmers[Game.shimmers.length-1].dur / 12);
    max = min + 4000;
  } else if (AP.Config.Clicking.ShimmerWhen == 2) {
    min = 1000 * (1 + Game.shimmers[Game.shimmers.length-1].dur / 12);
    max = 1000 * (1 + Game.shimmers[Game.shimmers.length-1].life / Game.fps);
  }
  setTimeout(AP.popOne, AP.Interval(min, max))
}

/*** Pantheon actions ***/

AP.spiritOfRuinActions = function() {
  action_taken = true;

  // If we're not buffing Devastation, then there's no action to take
  if (!AP.Options.buffDevastation())
    return !action_taken;

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

AP.slotSelebrakOrVomitrax = function() {
  pantheon_adjusted = true;
  pantheon = Game.Objects.Temple.minigame

  // If we have "Get lucky" but not "Lasting fortune", then the overlap
  // between Frenzy and BSorDH often isn't quite long enough causing us to
  // miss lots of opportunities to cast FHofF or CBG.  So, in such cases,
  // despite the small penalty to building production, use vomitrax in order
  // to extend the overlap.  In all other cases, use Selebrak to avoid the
  // building penalty while still increasing the overlap a little bit.  Also,
  // Selebrak helps find christmas/easter/halloween cookies/eggs.
  desired = 'seasons'
  if (Game.Has("Get lucky") && !Game.Has("Lasting fortune"))
    desired = "decadence"

  // Put Selebrak into the desired slot, if not already there
  if (pantheon.swaps == 3 && Game.hasGod(desired) != 2) {
    pantheon.dragGod(pantheon.gods[desired]);
    // slots used are 0-2, even though hasGod returns 1-3.
    pantheon.hoverSlot(2-1);
    pantheon.dropGod();
    console.log(`Moved ${desired == "seasons" ? "Selebrak" : "Vomitrax"}` +
                `into slot 2 at ${Date().toString()}`)
    return pantheon_adjusted;
  }

  return !pantheon_adjusted;
}

AP.slotRuin = function() {
  pantheon_adjusted = true;
  pantheon = Game.Objects.Temple.minigame

  // Put Godzamok into the desired slot, if not already there
  if (pantheon.swaps >= 2 && Game.hasGod('ruin') != 1) {
    pantheon.dragGod(pantheon.gods.ruin);
    // slots used are 0-2, even though hasGod returns 1-3.
    pantheon.hoverSlot(1-1);
    pantheon.dropGod();
    console.log(`Moved Godzamok into slot 1 at ${Date().toString()}`)
    return pantheon_adjusted;
  }

  return !pantheon_adjusted;
}

AP.slotCyclius = function() {
  pantheon_adjusted = true;
  pantheon = Game.Objects.Temple.minigame

  // Determine where we want this spirit
  value = Math.floor((Date.now() % 86400000) / 7200000)

  cyclius = pantheon.gods["ages"].id
  slot1available = (pantheon.slot[1] == -1) || (pantheon.slot[1] == cyclius)
  slot2available = (pantheon.slot[2] == -1) || (pantheon.slot[2] == cyclius)

  desiredSlot = false;
  if (value <= 1 && slot1available && slot2available)
    desiredSlot = 2
  else if (value <= 5 && slot2available)
    desiredSlot = 3
  else if (value % 6 <= 2 && slot1available)
    desiredSlot = 2

  // Exit if we don't have him and don't want him.
  if (!desiredSlot && !Game.hasGod('ages'))
    return !pantheon_adjusted;

  // Exit if we need to use a swap but aren't full
  if (desiredSlot > 0 && pantheon.swaps < 3)
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

  return !pantheon_adjusted;
}

AP.slotRigidel = function() {
  pantheon_adjusted = true;
  pantheon = Game.Objects.Temple.minigame

  desiredSlot = false;
  if (['fhof','cbg'].indexOf(AP.spell_factors['best']) != -1) {
    // When doing FHofF or CBG, we keep selebrak in slot 2, and use dotjiess
    // more infrequently
    if (Date.now() - Game.lumpT > Game.lumpRipeAge - 60*60*1000) {
      desiredSlot = 1;
    }
  } else {
    // Late game; using Dotjiess frequently and selebrak not so useful, so
    // stick Rigidel in slot 2
    if (Date.now() - Game.lumpT > Game.lumpRipeAge - 40*60*1000) {
      desiredSlot = 2;
    }
  }

  // Put Rigidel into the desired slot, if not already there
  if (desiredSlot && pantheon.swaps == 3 &&
      Game.hasGod('order') != desiredSlot) {
    pantheon.dragGod(pantheon.gods.ruin);
    // slots used are 0-2, even though hasGod returns 1-3.
    pantheon.hoverSlot(desiredSlot-1);
    pantheon.dropGod();
    console.log(`Moved Rigidel into slot ${desiredSlot} `+
                `at ${Date().toString()}`)
    return pantheon_adjusted;
  }

  return !pantheon_adjusted;
}

AP.adjustPantheon = function() {
  pantheon_adjusted = true;

  if (!AP.Config.Minigames.AdjustPantheon)
    return !pantheon_adjusted;

  pantheon = Game.Objects.Temple.minigame
  if (!pantheon)
    return !pantheon_adjusted;

  if (['fhof','cbg'].indexOf(AP.spell_factors['best']) != -1) {
    if (AP.slotSelebrakOrVomitrax() || AP.slotRuin() || AP.slotCyclius())
      return pantheon_adjusted;
  }
  if (AP.slotRigidel())
    return pantheon_adjusted;

  return !pantheon_adjusted;
}

/*** Spell-casting ***/

AP.compute_spell_factors = function(just_determining_bank_buffer) {
  //
  // First, Conjure Baked Goods
  //

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
  cbg_factor = 1.83 * ratio_of_desired_buffer;

  //
  // Second, Force the Hand of Fate
  //

  // If user doesn't want auto-clicking, then Force Hand of Fate has little
  // or no value.  Also, if we don't have enough wizard towers.
  if (AP.Config.Clicking.BigCookie == 0 ||
      AP.buildingMax["Wizard tower"] < 21) {
    fhof_factor = 0;
  } else {
    has_ruin = (Game.hasGod && Game.hasGod("ruin"))

    // Which is better: conjuring baked goods or forcing the hand of fate?
    ruin_mult = 1;
    if (AP.Options.buffDevastation()) {
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

    // Also, if we're using the spirit of ruin, 2 out of every 10 seconds
    // used on buying and selling buildings.  And we won't sell if there
    // won't be enough time left to make it worth it.
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

    fhof_factor = ruin_mult * cursor_mult * duration;
  }

  //
  // Third, Spontaneous Edifice
  //
  if (AP.buildingMax["Wizard tower"] < 77) {
    se_factor = 0;
  } else {
    average_expensive_building = 0;
    total_num = 0;
    for (item in Game.Objects) {
      num = Game.Objects[item].amount;
      if (num > 0 && num < 400) {
        average_expensive_building += Game.Objects[item].getPrice();
        total_num += 1;
      }
    }
    if (total_num > 0)
      average_expensive_building /= total_num;
    else if (Game.ObjectsById[Game.ObjectsById.length-1].amount == 400) {
      average_expensive_building = 40*10**39; // 40 duodecillion
    }

    se_factor = 0.000007327 * average_expensive_building / AP.trueCpS;
  }

  // With 73 magic, we can cast cbg 5 times.
  // With 81 magic, we can cast fhof 2 times.
  // With 77 magic, we can cast se 1 time.
  //   Those three values are close enough to equal that I'll just use 5,2,1
  factors = {
    'cbg'  : (AP.Options.adjustTowers() ? 5 : 1) * cbg_factor,
    'fhof' : (AP.Options.adjustTowers() ? 2 : 1) * fhof_factor,
    'se'   :                                       se_factor
  };
  best = 'cbg'; best_factor = factors['cbg']
  for (key in factors) {
    if (factors[key] > best_factor) {
      best = key;
      best_factor = factors[key];
    }
  }
  factors['best'] = best;
  return factors;
}

AP.handleSpellAdjustments = function(original_buff, min_buff_time_overlap,
                                     min_magic_needed, factor) {
  action_taken = true;

  // If there's a magic inept (a backfired diminish ineptitude, or the buff
  // has ended, or we've used up all our magic, then exit.
  AP.recomputeBuffs();
  grimoire = Game.Objects["Wizard tower"].minigame
  if (Game.buffs["Magic inept"] ||
      AP.currentBuff < original_buff ||
      AP.currentBuffTimeLeft < min_buff_time_overlap ||
      grimoire.magic < min_magic_needed) {
    clearInterval(AP.interval.grimoire);
    AP.interval.grimoire = undefined;
    return action_taken;
  }

  // If we hit a click frenzy while waiting to cast CBG (unlikely, but we're
  // checking just to be sure), then pursue the click frenzy in preference.
  // A human wouldn't be able to do both, so we have to pick one.
  if (AP.clickingNeeded())
    return action_taken;

  // Sell towers until we have the right amount
  if (AP.Options.adjustTowers() && grimoire.magic < grimoire.magicM) {
    mf = Math.floor(grimoire.magic);
    sell_until_exact = (Math.floor(factor*mf) < Math.floor(factor*(mf+1)))
    if (AP.adjustTowers(sell_until_exact))
      return action_taken; // Some towers sold
  }

  // Add a simple delay between tower selling and casting whatever spell.
  // Probably could be done better with delay tokens than random numbers,
  // but whatever...
  if (AP.Options.adjustTowers() && Math.random() < 2/3)
    return action_taken; // Wait until interval firing this function fires again

  return !action_taken;
}

AP.conjureBakedGoods = function(original_buff) {
  grimoire = Game.Objects["Wizard tower"].minigame;
  min_overlap = 8;
  factor = (Game.buffs["Magic adept"] ? .4 : .2);
  min_magic = (AP.Options.adjustTowers() ? 4
                                         : Math.floor(2 + .4*grimoire.magicM));
  if (AP.handleSpellAdjustments(original_buff, min_overlap, min_magic, factor))
    return;

  // We need to cast diminish ineptitude first (unless we already did this
  // on a previous round through this function, or there was one leftover from
  // a long time ago).
  if (!Game.buffs["Magic adept"] ||
      Game.buffs["Magic adept"].time < 30*Game.fps) {
    grimoire.castSpell(grimoire.spells["diminish ineptitude"]);
    if (!Game.buffs["Magic adept"])
      console.log(`Diminish ineptitude failed; not trying to CBG ` +
                  `at ${Date().toString()}`);

    // Don't immediately cast CBG; wait until next interval loop in order
    // to have a more human-like pause between the two spells.
    return;
  }

  // If not selling wizard towers, we want to wait until the buff is nearly
  // over, since we'll only get one shot and would like to let magic refill
  // when we're further from being fully depleted.
  if (!AP.Options.adjustTowers()) {
    time_left = Math.min(AP.currentBuffTimeLeft,
                         Game.buffs["Magic adept"].time/Game.fps);
    if (time_left > 20)
      return;
    if (time_left > 5 && Math.random() > 1/75)
      return;
  }

  // Log info about our CBG casting.
  desired_bank_buffer = 30 * 60 * Game.cookiesPs / 0.15;
  percentage_of_wanted = Math.min(100, 100 * Game.cookies / desired_bank_buffer);
  console.log(`Cast Conjure Baked Goods ` +
              `during x${AP.currentBuff} buff ` +
              `with ${percentage_of_wanted.toFixed(0)}% of bank ` +
              `at ${Date().toString()}`)

  // Finally cast the spell
  cbg = Game.Objects["Wizard tower"].minigame.spells["conjure baked goods"];
  Game.Objects["Wizard tower"].minigame.castSpell(cbg);
}

AP.forceHandOfFate = function(original_buff) {
  // Avoid buying (or adjusting towers -- especially selling) when about to
  // cast forceHandOfFate
  AP.timer.lastActionCheck = Date.now();

  // Adjust towers as needed
  grimoire = Game.Objects["Wizard tower"].minigame;
  min_overlap = 25; /* Includes waiting for GC to appear & time to click it */
  min_magic = (AP.Options.adjustTowers() ? 23
                                         : Math.floor(10+.6*grimoire.magicM));
  if (AP.handleSpellAdjustments(original_buff, min_overlap, min_magic, .6))
    return;

  // Cast the hand of fate, and trigger a timeout to act on it
  grimoire.castSpell(grimoire.spells["hand of fate"])
  AP.logHandOfFateCookie = true;
  setTimeout(AP.shimmerAct, AP.Interval(3000, 4000))
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
  if (Game.buffs["Magic inept"])
    return;

  factors = AP.compute_spell_factors(0);
  if (factors['best'] == 'cbg') {
    // Do we have enough to cast diminish ineptitude and conjure baked goods?
    if (AP.Options.adjustTowers()) {
      if (grimoire.magic < 11)
        return;
    } else if (grimoire.magicM < 13)
      return;
    else if (grimoire.magicM == 13 &&
        (grimoire.magic != 13 || AP.currentBuffTimeLeft < 72))
      return;
    else if (grimoire.magicM >= 14 &&
        grimoire.magic < Math.floor(0.6 * grimoire.magicM) + 7)
      return;

    buffWas = AP.currentBuff;
    callback = function() {AP.conjureBakedGoods(buffWas)};
    if (AP.interval.grimoire)
      clearInterval(AP.interval.grimoire);
    AP.interval.grimoire = setInterval(callback, 200);
  } else if (factors['best'] == 'fhof') {
    // Avoid buying (or adjusting towers -- especially selling) when about to
    // cast forceHandOfFate
    AP.timer.lastActionCheck = Date.now();

    buffWas = AP.currentBuff;
    callback = function() {AP.forceHandOfFate(buffWas)};
    if (AP.interval.grimoire)
      clearInterval(AP.interval.grimoire);
    AP.interval.grimoire = setInterval(callback, 200);
  } else if (factors['best'] == 'se') {
    // Do nothing; we don't cast spontaneous edifice in response to golden
    // cookies, just in response to magic filling up.
  } else {
    console.error("Unexpected best spell choice; can't handle: " +
                  factors['best']);
  }
}

AP.adjustTowers = function(sell_until_equal) {
  action_taken = true;
  difference_allowed = (sell_until_equal ? 0 : 1);

  if (!AP.Options.adjustTowers())
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
  // slow down when we get close.  When buying, we need to go slow to avoid
  // buying too many.
  if (AP.towerInterval) {
    delay = (grimoire.magicM - Math.floor(grimoire.magic) >= 3 ||
             grimoire.magicM == grimoire.magic) ? 3 : 1;
    if (Math.random() > 1/delay)
      return action_taken;
  }

  // Determine whether we need to buy or sell towers, or if we're all done
  if (grimoire.magicM == grimoire.magic && towers.getPrice() < 1*AP.trueCpS) {
    AP.buyBuilding('Wizard tower', 1);
    return action_taken;
  } else if (grimoire.magicM > grimoire.magic + difference_allowed &&
             towers.amount > 2) {
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
    AP.timer.lastActionCheck = Date.now() + 2500;
  }

  return !action_taken;
}

AP.castASpell = function() {
  action_taken = true;
  grimoire = Game.Objects["Wizard tower"].minigame;
  if (AP.Config.Minigames.SpellCasting &&
      AP.spell_factors['best'] == 'se' &&
      grimoire.magic == grimoire.magicM &&
      grimoire.magic >= 77) {

    // Sell most expensive building, if we don't have enough cookies
    expensive = {'item': undefined, cost: 0};
    for (item in Game.Objects) {
      num = Game.Objects[item].amount;
      cost = Game.Objects[item].getPrice();
      if (num > 0 && num < 400 && cost > expensive.cost) {
          expensive.item = item;
          expensive.cost = cost;
      }
    }

    if (Game.cookies < expensive.cost/2) {
      console.log(`Insufficient funds; selling a ${expensive.item} (` +
                  `cookies == ${Beautify(Game.cookies)}, ` +
                  `cost == ${Beautify(expensive.cost)}, ` +
                  `#${expensive.item} == ${Game.Objects[expensive.item].amount})`);
      AP.sellBuilding(expensive.item, 1);
    } else {
      console.log(`Cast Spontaneous Edifice at ${Date().toString()}`);
      se = Game.Objects["Wizard tower"].minigame.spells["spontaneous edifice"];
      Game.Objects["Wizard tower"].minigame.castSpell(se);
    }
    return action_taken;
  }

  return !action_taken;
}

/*** Lump harvesting ***/

AP.harvestLumps = function() {
  action_taken = true;

  if (!AP.Config.Minigames.HarvestSugarLumps)
    return !action_taken;

  // If a lump is ripe, harvest it now
  if (Date.now() - Game.lumpT > Game.lumpRipeAge) {
    Game.clickLump();
    return action_taken;
  }

  // If Rigidel slotted but inactive, and the lump would be ripe if Rigidel
  // effect was active, then sell off cursors to make it active.
  order_slot = (Game.hasGod && Game.hasGod("order"));
  if (order_slot &&
      Game.BuildingsOwned % 10 != 0 &&
      AP.Config.Minigames.AdjustCursors &&
      Game.Objects["Cursor"].amount > 10) {
    time_off = 20*60*1000 * (4-order_slot); // 20 minutes * (4-order_slot)
    if (Date.now() - Game.lumpT > Game.lumpRipeAge - time_off) {
      AP.sellBuilding('Cursor', 1);
      return action_taken;
    }
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

  // Recompute the max number of buildings.
  AP.buildingMax[bldg] = Math.max(
    AP.buildingMax[bldg], Game.Objects[bldg].amount);
}

AP.sellBuilding = function(bldg, num) { // Use num == -1 to sell all
  // It's possible a user bought some buildings before we go to sell.  So,
  // recompute the max here too.
  AP.buildingMax[bldg] = Math.max(
    AP.buildingMax[bldg], Game.Objects[bldg].amount);

  // Unlike .buy(), sell() is more sane; it doesn't look at buyMode to
  // decide whether to invert the meaning and switch between buying and
  // selling behind the user's back, so no need to temporarily toggle
  // Game.buyMode.  Yaay.
  Game.Objects[bldg].sell(num);
  Game.Objects[bldg].refresh();
}

AP.getSpontaneousEdificeBonus = function(item, price) {
  if (!AP.Config.Minigames.SpellCasting)
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

AP.getBestBonus = function(item, price) {
  // See AP.getTruePP for what pp really means.  We simply abuse it in this
  // function, calculating it kind of as
  //    fakePrice / bonus
  // where fakePrice = AP.trueCpS, meaning we treat everything as having the
  // same price and thus try to buy whatever has the biggest bonus.  However,
  // we special case things we don't have enough money for and treat them as
  // having huge PP.
  if (price > Game.cookies) {
    return {pp: Number.MAX_VALUE, ratios: []};
  }

  if (CM.Cache.Upgrades[item]) {
    // Do a special computation of projected payoff for particular items that
    // CookieMonster simply returns Infinity for.
    special_factor = AP.specialPPfactor[item]
    if (special_factor) {
      if (!AP.Options.clickSomeShimmers())
        special_factor = Math.min(special_factor, 0.5);
      bonus = special_factor * AP.trueCpS;
    } else {
      bonus = CM.Cache.Upgrades[item].bonus / AP.currentBuff;
    }
  } else if (CM.Cache.Objects[item]) {
    bonus = CM.Cache.Objects[item].bonus / AP.currentBuff;
    for (cost of AP.bulk_cost_factor)
      if (price*cost < Game.cookies)
        bonus *= 10;
  }

  // Return what we found
  return {pp: AP.trueCpS/bonus, ratios: []};
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
        special_factor = Math.min(special_factor, 0.5);
      pp = Game.Upgrades[item].getPrice() / (special_factor * AP.trueCpS);
    } else {
      pp = CM.Cache.Upgrades[item].pp * AP.currentBuff;
    }
    bonus_ratios = [];
  } else if (CM.Cache.Objects[item]) {
    normal_bonus = CM.Cache.Objects[item].bonus / AP.currentBuff;
    if (AP.Options.clickSomeShimmers()) {
      bs_bonus = AP.building_special_factor * AP.trueCpS / 10;
    } else {
      bs_bonus = 0;
    }
    se_bonus = AP.getSpontaneousEdificeBonus(item, price) / 10;
    combined_bonus = normal_bonus + bs_bonus + se_bonus;
    biggest = Math.max(normal_bonus, bs_bonus, Math.abs(se_bonus));
    bonus_ratios = [normal_bonus/biggest, bs_bonus/biggest, se_bonus/biggest];
    pp = (Math.max(price - Game.cookies, 0) / Game.cookiesPs) +
          (price / Math.max(0, combined_bonus));
  }

  // Return what we found
  return {pp: pp, ratios: bonus_ratios};
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
  return {pp: pp, ratios: []};
}

AP.itemLimitsForMinigames = function(item, price) {
  if (item === "Cursor" &&
      AP.Options.buffDevastation() &&
      price > 1*AP.trueCpS) {
    return Number.MAX_VALUE;
  } else if (item === "Wizard tower" && AP.Options.adjustTowers()) {
    // Only buy towers to increase magic (done elsewhere), not because of
    // cookie generation
    return Number.MAX_VALUE;
  }
  return 0;
}

AP.determineBestBuy = function(metric) {
  // First purchase is always a Cursor.  Also, when we haven't yet bought
  // anything, pp for all upgrades is NaN or Infinity, so we really do
  // need a special case here.
  if (Game.cookiesPs === 0 && AP.Options.purchaseBuildings()) {
    return {name: "Cursor", price: Game.Objects.Cursor.getPrice(), amount: 1,
            pp: CM.Cache.Objects.Cursor.pp, obj: Game.Objects.Cursor,
            ratios: []}
  }

  // Find the item with the lowest projected payoff
  lowestPP = Number.MAX_VALUE;
  best = {};
  if (AP.Options.purchaseUpgrades()) {
    for (item in CM.Cache.Upgrades) {
      if (Game.Upgrades[item].unlocked) {
        if (AP.upgradesToIgnore.indexOf(item) === -1) {
          price = Game.Upgrades[item].getPrice();
          ppinfo = metric(item, price);
          if (ppinfo.pp < lowestPP) {
            lowestPP = ppinfo.pp;
            best = {name: item, price: price, amount: 1,
                    pp: ppinfo.pp, ratios: [], obj: Game.Upgrades[item]}
          } //else { console.log(`Skipping ${item}; not better PP`) }
        } //else { console.log(`Skipping ${item}; in ignore list`) }
      } //else { console.log(`Skipping ${item}; not unlocked`) }
    }
  }
  if (AP.Options.purchaseBuildings()) {
    for (item in CM.Cache.Objects) {
      price = Game.Objects[item].getPrice();
      ppinfo = metric(item, price);
      ppinfo.pp = Math.max(ppinfo.pp, AP.itemLimitsForMinigames(item, price));
      if (ppinfo.pp < lowestPP) {
        lowestPP = ppinfo.pp;
        best = {name: item, price: price, amount: 1,
                pp: ppinfo.pp, ratios: ppinfo.ratios, obj: Game.Objects[item]}

        // Determine if we should buy in bulk
        bulk_amount = 1;
        limit = 5*AP.trueCpS;
        if (AP.use_alternate_purchase_strategy_after_restart)
          limit = CM.Cache.lastCookies;
        for (count of [10, 100]) {
          total_cost = AP.costToPurchase(count, best.price)
          if (total_cost < limit && CM.Cache.lastCookies >= total_cost)
            bulk_amount = count;
        }
        best.amount = bulk_amount;

      } //else { console.log(`Skipping ${item}; not better PP`) }
    }
  }
  return best
}

AP.determinePatientBankBuffer = function(item_pp) {
  // Special case getting started
  if (Game.cookiesPs === 0)
    return 0;

  // Sanity check
  if (AP.spell_factors['best'] != 'cbg' && AP.spell_factors['best'] != 'fhof')
    console.error("Should not have reached here when " +
                  `AP.spell_factors['best'] = ${AP.spell_factors['best']}`);

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
        if (AP.spell_factors['best'] == 'cbg')
          return 2*CM.Cache.LuckyFrenzy - cookies_before_gc;
        else if (AP.spell_factors['best'] == 'fhof')
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
        if (AP.spell_factors['best'] == 'cbg')
          return 30*CM.Cache.LuckyFrenzy - cookies_before_gc;
        else if (AP.spell_factors['best'] == 'fhof')
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
  // FIXME: Code for bank buffer with spontaneous edifice should move here too
  if (AP.Config.Purchase.When == 1)
    return 0;
  else if (AP.Config.Purchase.When == 2)
    // Save 5 minutes of CpS per log_100(CpS), technically maxing out at
    // 105 minutes (== 7*15), though it's really hard to hit that max
    return 300 * AP.trueCpS * Math.min(21, 0.5*Math.log10(AP.trueCpS))
  else if (AP.Config.Purchase.When == 3)
    return AP.determinePatientBankBuffer(item_pp);

  console.error(`Invalid AP.Config.Purchase.When value of ${AP.Config.Purchase.When} in AP.determineBankBuffer`);
}

AP.determineBestSpontaneousPurchase = function() {
  most_expensive_building = Game.ObjectsById[Game.ObjectsById.length-1]
  most_expensive_price = most_expensive_building.getPrice();

  // Sell the most expensive building, if conditions are right
  if (most_expensive_building.amount == 400) {
    console.log(`Selling a ${most_expensive_building.name}; we hit 400.`);
    return {name: most_expensive_building.name, price: most_expensive_price,
	    amount: -1, pp: 3600, ratios: [], obj: most_expensive_building};
  }

  // Find out best building to buy (we'll only buy it if we have enough
  // buffer in the bank)
  best = {}
  best_price = most_expensive_price*1.001;
  for (name in Game.Objects) {
    bldg = Game.Objects[name]
    bldg_price = bldg.getPrice();
    if (bldg.amount < 400 && bldg_price < best_price &&
        (bldg.amount < 399 || name !== most_expensive_building.name)) {
      best_price = bldg_price;
      best = {name: name, price: bldg_price, amount: 1,
              pp: 3600, ratios: [], obj: bldg};
    }
  }

  return best;
}

AP.purchaseStrategy = function() {
  choice = undefined
  if (AP.use_alternate_purchase_strategy_after_restart) {
    choice = AP.determineBestBuy(AP.getBestBonus);
    if (choice.name && Date.now() - Game.startDate < 30*60*1000) {
      choice.buffer = 0;
      return choice;
    }
    AP.use_alternate_purchase_strategy_after_restart = false;
  }

  if (AP.spell_factors['best'] == 'se') {
    choice = AP.determineBestSpontaneousPurchase();
    if (choice.amount > 0) {
      // 0.5 is not enough; if you have just under 0.5, then the logic will
      // sell the most expensive building, you'll have a whole bunch of
      // cash, the price of the most expensive building will go down
      // slightly, you'll re-buy it, then you again won't have enough,
      // you'll sell another one, then you'll finally spontaneous edifice.
      // Just make the buffer a little higher to avoid this weird cycle.
      buffer = 0.6 * Game.ObjectsById[Game.ObjectsById.length-1].getPrice();
    } else {
      // If we're selling, we don't need to wait.
      buffer = -1 * choice.price;
    }
  } else {
    choice = AP.determineBestBuy(AP.getTruePP);
    buffer = AP.determineBankBuffer(choice.pp);

    // If we don't have enough to buy the best item, check for super cheap
    // items (make sure super cheap items that don't directly impact CpS but
    // have some kind of indirect impact eventually get bought).
    if (!choice.price || CM.Cache.lastCookies < buffer + choice.price) {
      choice = AP.determineBestBuy(AP.getCheapItem);
      // choice could be {} here
      if (choice.name)
        buffer = 0;
    }
  }

  choice.buffer = buffer;
  return choice;
}

AP.handlePurchases = function() {
  purchaseMade = true;

  // Set a small factor to help with building purchase decisions
  AP.building_special_factor = 0.000058;
  if (Game.Has('Lucky day')) AP.building_special_factor = 0.00011;
  if (Game.Has('Serendipity')) AP.building_special_factor = 0.00021;
  if (Game.Has('Get lucky')) AP.building_special_factor = 0.0009;

  // Use a slightly modified strategy after restarts, to start up quicker
  if (Game.resets > 0 && Date.now() - Game.startDate < 10000) // 10000 ms = 10s
    AP.use_alternate_purchase_strategy_after_restart = true;

  // Find out what to purchase
  log_purchase_for_user = true;
  best = AP.purchaseStrategy();

  if (best.amount == 0)
    return !purchaseMade;

  // Don't log the purchase for the user if we're just buying back what we
  // already had before
  if (Game.resets > AP.lastResets) {
    AP.lastResets = Game.resets
    for (bldg in Game.Objects)
      AP.buildingMax[bldg] = Game.Objects[bldg].amount;
  } else if (Game.Objects[best.name] &&
             AP.buildingMax[best.name] >=
             Game.Objects[best.name].amount + best.amount) {
    log_purchase_for_user = false;
  }

  // Purchase if we have enough
  if (best.price && best.amount != 0 &&
      CM.Cache.lastCookies >= best.buffer + best.price) {

    if (!(best.name in Game.Objects))
      best.obj.buy();
    else if (best.amount > 0)
      AP.buyBuilding(best.name, best.amount);
    else // best.amount < 0
      AP.sellBuilding(best.name, -1*best.amount);

    // Log what we're doing
    if (log_purchase_for_user) {
      ratio_string = ''
      if (best.ratios.length) {
        formatted_ratios = best.ratios.map(x=>{return x.toExponential(2)});
        ratio_string = ` and ratios [${formatted_ratios.join(', ')}]`;
      }
      console.log(`Bought ${best.amount} ${best.name}(s) `+
                  `(with PP of ${Beautify(best.pp)}${ratio_string}) ` +
                  `at ${Date().toString()}`)
    }
    purchaseMade = true;
  } else {
    purchaseMade = false;
  }

  return purchaseMade;
}

/*** Overall actions ***/

AP.handleActions = function() {
  // Don't run this function too often, even if stats are updated more
  // frequently (see CM.Config.UpStats and CM.ConfigData.UpStats)
  if (Date.now() - AP.timer.lastActionCheck < 5000 ||
      Date.now() - AP.timer.lastPop < 10000)
    return;
  AP.timer.lastActionCheck = Date.now();

  // Don't buy upgrades or buildings while in a clickfest or adjusting towers
  if (AP.clickInterval || AP.towerInterval) {
    return;
  } else if ((AP.spell_factors['best'] == 'cbg' ||
              AP.spell_factors['best'] == 'fhof') &&
             AP.adjustTowers()) {
    // One adjustment usually isn't enough; make sure we keep adjusting until
    // it's up or down to the right value
    AP.towerInterval = setInterval(AP.adjustTowers, 200);
    return;
  } else if (AP.harvestLumps()) {
    return;
  } else if (AP.adjustPantheon()) {
    return;
  } else if (AP.castASpell()) {
    return;
  } else if (AP.Options.doSomePurchases() && AP.handlePurchases()) {
    return;
  }

  // Nothing to do this interval.  Maybe there will be next time.
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
    Global: {
      Enable: 0,
    },
    Purchase: {
      Types: 3,
      When: 3,
    },
    Clicking: {
      BigCookie: 1,
      ShimmerTypes: 1,
      ShimmerWhen: 1,
    },
    Minigames: {
      HarvestSugarLumps: 1,
      AdjustPantheon: 1,
      AdjustCursors: 1,
      SpellCasting: 1,
      AdjustTowers: 1,
    }
  };

  AP.ConfigData.Global = {};
  AP.ConfigData.Global.Enable = {
    label: ['Disabled',
            'Enabled'],
    desc: 'Whether AutoPlay is enabled; if not, options below are irrelevant'
    };

  AP.ConfigData.Purchase = {};
  AP.ConfigData.Purchase.Types = {
    label: ['None',
            'Just Buildings',
            'Just Upgrades & Research',
            'Buildings & Upgrades & Research'],
    desc: 'Types of purchases to automatically make',
    };
  AP.ConfigData.Purchase.When = {
    label: ['Never',
            'As soon as I have enough money',
            'Leave a little buffer',
            'Patience, grasshopper'],
    desc: 'Automatic purchase timing for buildings and upgrades',
    };

  AP.ConfigData.Clicking = {}
  AP.ConfigData.Clicking.BigCookie = {
    label: ['Never',
            'Only during click specials'],
    desc: 'When to automatically click the big cookie',
    };
  AP.ConfigData.Clicking.ShimmerTypes = {
    label: ["I'll click my own shimmers",
            'Not them wrath cookies!',
            'Click all the things!'],
    desc: 'Shimmer types (golden/wrath cookies, reindeer) to autoclick',
    };
  AP.ConfigData.Clicking.ShimmerWhen = {
    label: ['Never',
            'When they show up',
            'Eh, whenever'],
    desc: 'When to autoclick shimmers (golden/wrath cookies, reindeer)',
    };

  AP.ConfigData.Minigames = {};
  AP.ConfigData.Minigames.HarvestSugarLumps = {
    label: ['Disable',
            'Enable'],
    desc: 'Automatically harvest sugar lumps when ripe',
    };
  AP.ConfigData.Minigames.AdjustPantheon = {
    label: ['Disable',
            'Enable'],
    desc: 'Automatically adjust slots in the Pantheon minigame',
    };
  AP.ConfigData.Minigames.AdjustCursors = {
    label: ['Disable',
            'Enable'],
    desc: 'Automatically adjust cursors to take advantage of pantheon effects',
    };
  AP.ConfigData.Minigames.SpellCasting = {
    label: ['Disable',
            'Enable'],
    desc: 'Automatically cast spells from the Grimoire minigame',
    };
  AP.ConfigData.Minigames.AdjustTowers = {
    label: ['Disable',
            'Enable'],
    desc: 'Automatically adjust towers to make spell casting easier',
    };
}

AP.ToggleConfig = function(config) {
  [group, setting] = config.split('.')
  AP.Config[group][setting]++;
  if (AP.Config[group][setting] == AP.ConfigData[group][setting].label.length)
    AP.Config[group][setting] = 0;
  l(AP.ConfigPrefix + config).innerHTML =
    AP.ConfigData[group][setting].label[AP.Config[group][setting]];
}

AP.AddMenuPref = function() {
  var new_menu = document.createDocumentFragment();
  var title = document.createElement('div');
  title.className = 'title ' + CM.Disp.colorTextPre + CM.Disp.colorBlue;
  title.textContent = 'Cookie Clicker AutoPlay';
  new_menu.appendChild(title);

  var header = function(text) {
    var div = document.createElement('div');
    div.className = 'listing';
    div.style.padding = '5px 16px';
    div.style.opacity = '0.7';
    div.style.fontSize = '17px';
    div.style.fontFamily = '\"Kavoon\", Georgia, serif';
    div.textContent = text;
    return div;
  }

  var listing = function(config) {
    var div = document.createElement('div');
    div.className = 'listing';
    var a = document.createElement('a');
    a.className = 'option';
    a.id = AP.ConfigPrefix + config;
    a.onclick = function() {AP.ToggleConfig(config);};
    [group, setting] = config.split('.')
    config_setting = AP.Config[group][setting];
    a.textContent = AP.ConfigData[group][setting].label[config_setting];
    div.appendChild(a);
    var label = document.createElement('label');
    label.textContent = AP.ConfigData[group][setting].desc;
    div.appendChild(label);
    return div;
  }

  new_menu.appendChild(listing('Global.Enable'));
  new_menu.appendChild(header('Purchase Decisions'));
  new_menu.appendChild(listing('Purchase.Types'));
  new_menu.appendChild(listing('Purchase.When'));
  new_menu.appendChild(header('Auto-clicking'));
  new_menu.appendChild(listing('Clicking.BigCookie'));
  new_menu.appendChild(listing('Clicking.ShimmerTypes'));
  new_menu.appendChild(listing('Clicking.ShimmerWhen'));
  new_menu.appendChild(header('Minigames'));
  new_menu.appendChild(listing('Minigames.HarvestSugarLumps'));
  new_menu.appendChild(listing('Minigames.AdjustPantheon'));
  new_menu.appendChild(listing('Minigames.AdjustCursors'));
  new_menu.appendChild(listing('Minigames.SpellCasting'));
  new_menu.appendChild(listing('Minigames.AdjustTowers'));

  l('menu').childNodes[2].insertBefore(new_menu, l('menu').childNodes[2].childNodes[l('menu').childNodes[2].childNodes.length - 1]);
}

AP.Options.doSomePurchases = function() {
  return AP.Config.Global.Enable != 0 &&
    AP.Config.Purchase.Types != 0 && AP.Config.Purchase.When != 0;
}

AP.Options.purchaseBuildings = function() {
  return AP.Config.Global.Enable != 0 && (AP.Config.Purchase.Types & 1);
}

AP.Options.purchaseUpgrades = function() {
  return AP.Config.Global.Enable != 0 && (AP.Config.Purchase.Types & 2);
}

AP.Options.clickSomeShimmers = function() {
  return AP.Config.Global.Enable != 0 &&
    AP.Config.Clicking.ShimmerTypes != 0 && AP.Config.Clicking.ShimmerWhen != 0;
}

AP.Options.buffDevastation = function() {
  return AP.Config.Minigames.AdjustCursors != 0 &&
         Game.hasGod && Game.hasGod("ruin") &&
         AP.buildingMax.Cursor > 100;
}

AP.Options.adjustTowers = function() {
  return AP.Config.Minigames.AdjustTowers != 0 &&
         Game.Objects["Wizard tower"].minigame &&
         AP.buildingMax["Wizard tower"] > 55;
}

/*** Monkey patching and initialization ***/

AP.shimmerFunction = function(url) {
  // CM.Disp.PlaySound is called unconditionally, but then checks the options
  // to determine whether to actually play the sound, so even if the sound
  // option is off, we can use this to auto-click golden cookies.  :-)
  if (Game.shimmers.length && AP.Options.clickSomeShimmers())
    AP.ShimmerAppeared();
  AP.Backup.PlaySound(url);
}

AP.RemakePP = function() {
  AP.Backup.RemakePP();

  AP.recomputeBuffs();
  AP.spell_factors = AP.compute_spell_factors(1);
  AP.handleActions();
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
  AP.timer.lastActionCheck = Date.now();
  AP.buildingMax = {};
  AP.clickInterval = undefined;
  AP.towerInterval = undefined;
  AP.interval = {}
  AP.logHandOfFateCookie = false;
  AP.lastResets = Game.resets - 1;

  AP.bulk_cost_factor = [AP.costToPurchase(10, 1), AP.costToPurchase(100, 1)];

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
      "Sugar Frenzy",
      "One mind",
      "Communal brainsweep",
      "Elder Pact",
      "Elder Covenant",
      "Revoke Elder Covenant",
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
