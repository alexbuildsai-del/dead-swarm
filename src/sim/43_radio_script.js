'use strict';
/* ==========================================================================
   sim/43_radio_script.js — K-DED 88.1 "The Last Signal": every line Lou Vesper
   says, keyed by situation. All bands, songs, sponsors and callers are made up.

   Placeholders (filled by DS.radioFormat): {name} survivor first name, {map}
   map short name, {count} call-in target, {kills}, {level}, {k} (hold-out
   minute), {evo} (evolution name), {time}. IMPORTANT: keys read by the core or
   the director are said raw, so those lines must not contain placeholders.
   ========================================================================== */
DS.RADIO = DS.RADIO || {};
(function (R) {
  const add = (key, lines) => { R[key] = (R[key] || []).concat(lines); };

  /* ---------------- keys read by the CORE (no placeholders) ---------------- */
  add('revive', [
    'GET UP. Get up, get up — there you go. Second wind, sugar. Don\'t waste it.',
    'Whoa, whoa — you\'re back! Lou nearly dropped her coffee. Stay up this time.',
    'Not tonight. Not on my frequency. Up you get, champ.',
    'Second wind! Somebody up there likes you. Probably me. I\'m up a water tower.'
  ]);
  add('evacIncoming', [
    'Chopper inbound! Six seconds to touchdown. Clear a spot and get ready.',
    'Rotor noise on the horizon — that\'s your ride! Find the pad when it lands.',
    'Bird\'s coming in hot. Six seconds. Don\'t let the neighbours hitch a lift.',
    'Evac\'s on approach! Somebody finally answered my mayday. Get to the pad.'
  ]);
  add('heliLeaves', [
    'Chopper\'s pulling out. Back in two minutes. Hang on till then.',
    'And there goes the bird. Two minutes, honey. Make them count.',
    'Rotors fading. Pilot says two minutes and a sandwich. Hold the line.',
    'Pad\'s empty again. Two-minute loop. Lou will keep you company.'
  ]);
  add('heliReturns', [
    'Chopper\'s swinging back around! Thirty seconds on the pad — be there.',
    'Here comes your ride again. Thirty-second window. Don\'t make it wait.',
    'Bird\'s back! Pilot says thirty seconds, then he\'s gone. He means it.',
    'Rotors again! Window\'s open. Get out or stay crazy — your call.'
  ]);
  add('holdOut', [
    'You\'re staying? You beautiful lunatic. Fine. Lou\'s not going anywhere either.',
    'Holding out! Every minute out there pays. Every minute out there bites.',
    'Pilot thinks you\'re nuts. I think you\'re ratings gold. Chopper\'s back in two.',
    'Okay, night owl. Endless mode. I\'ll put the kettle on. Big kettle.'
  ]);
  add('gasWarn', [
    'Gas is moving in from the edges. Get inside the line, fast.',
    'Green fog on the fence line! It\'s shrinking the zone — get toward the middle.',
    'Smell that? That\'s the gas. Don\'t smell it any closer. Move inward.',
    'Heads up: the cloud\'s closing in. Stay inside the safe ring, sugar.'
  ]);
  add('ambulanceBroken', [
    'The ambulance is down! Get over there and get your hands greasy.',
    'Ambulance just quit on us! Stand next to it and coax it back to life.',
    'They\'ve chewed through the ambulance! Fix it before they chew through you.',
    'Code Blue just went Code Broken. Get to that ambulance and fix it!'
  ]);

  /* ---------------- keys read by the DIRECTOR (no placeholders) ---------------- */
  add('eventEncirclement', [
    'They\'re closing the circle. Find a gap before there isn\'t one.',
    'Look around, sugar. All the way around. That\'s a ring of teeth. Punch through.',
    'Circle\'s tightening! Don\'t wait for it to close — break it.',
    'Oh, they\'re organised tonight. A whole ring of them. Pick a side and go.'
  ]);
  add('eventStampede', [
    'Hear that rumble? That\'s not thunder. Sidestep. NOW.',
    'Bulls on the run! Watch the edge of your screen and get out of the lane.',
    'Stampede! Big boys, one direction, zero brakes. Don\'t be the direction.',
    'The ground\'s shaking, honey. Something heavy wants to run you over. Don\'t let it.'
  ]);
  add('eventTide', [
    'Here comes the tide. A whole wall of them. Don\'t be a sandcastle.',
    'Big wave incoming! Find the thin spot and swim through.',
    'Whole neighbourhood\'s walking your way at once. Brace, brace, brace.',
    'Tide\'s rolling in. You can\'t outrun the ocean, but you can out-shoot it.'
  ]);
  add('eventSiren', [
    'Siren\'s going. Everybody runs tonight. Everybody.',
    'Air-raid siren just kicked on. They love it. They\'re sprinting. Keep moving.',
    'That wail? It winds them up like toys. Thirty seconds of fast feet. Theirs and yours.',
    'Siren night! Every rotter in earshot just got a second wind. Don\'t stand still.'
  ]);
  add('sirenEnd', [
    'Siren\'s quiet. They\'re back to strolling. Catch your breath.',
    'And the wailing stops. Good. My ears were bleeding. Figuratively.',
    'Siren\'s done. Back to regular-speed horror. Lovely.'
  ]);
  add('eventEliteHunt', [
    'Three big ones on my scanner. Tagged \'em. Drop all three in 45 for a fat crate.',
    'Hunting season! Three tagged elites, forty-five seconds. Bring me their tags.',
    'I\'ve tagged three bruisers out there. Put them down quick and the crate\'s yours.',
    'Scanner\'s lit up with three big signatures. Clock\'s running. Happy hunting.'
  ]);
  add('eliteHuntWin', [
    'All three tags down! Crate\'s yours, hunter.',
    'Clean sweep! Three trophies and a crate. Lou is impressed. Lou is rarely impressed.',
    'That\'s the hunt done. Collect your prize, you terrifying person.'
  ]);
  add('eliteHuntFail', [
    'Time\'s up on the hunt. They\'re still out there, but so are you.',
    'Hunt\'s over. Some got away. They\'ll be back. They always come back.',
    'Missed the window on that one. No crate, no shame. Mostly no shame.'
  ]);
  add('miniboss', [
    'Something big just walked into town. Heavy footsteps. Real heavy. Get ready.',
    'Ooh, I don\'t like that shape on the scanner. Big one incoming. Keep your distance.',
    'Heads up — a bruiser with a grudge. Watch the red marks and hit it hard.',
    'That\'s no ordinary rotter. That one\'s got a name. Make it a short one.'
  ]);
  add('finalBoss', [
    'This is it. The big one. Everything you\'ve got, right now.',
    'Fifteen minutes on the clock and here comes the headliner. Give it hell.',
    'My scanner just ran out of room. That thing is enormous. Kill it and the chopper comes.',
    'The whole night\'s been building to this. Lou\'s got your back. Go.'
  ]);
  add('bossPhase', [
    'It\'s getting angry. That\'s good. Angry means hurting.',
    'It just changed gears! New moves — watch the red, keep moving.',
    'You\'re getting to it. It knows. It\'s furious. Don\'t stop now.',
    'Ooh, it\'s mad. Mad and wobbly. Keep the pressure on.'
  ]);

  /* ---------------- run start ---------------- */
  add('intro_suburbs', [
    'Good evening, Maple Hollow. Lou Vesper, K-DED 88.1, The Last Signal. Lock your doors. Then check again.',
    'This is Lou, live from the old water tower. Maple Hollow\'s lawns are dead. So is most of the street.',
    'K-DED 88.1, The Last Signal. Tonight in Maple Hollow: three dead generators and a lot of hungry neighbours.',
    'Evening, Maple Hollow. Power the generators, keep moving, and don\'t trust the garden gnomes.'
  ]);
  add('intro_hospital', [
    'St. Agnes Hospital. Visiting hours are over. Forever. Lou here — that ambulance in the bay still runs.',
    'You\'re in St. Agnes now, sugar. Tight halls, bad lights. Get that ambulance out and you\'re a saint too.',
    'K-DED 88.1, coming to you over the hospital intercom. Lights flicker, doors stick, patients bite.',
    'Welcome to St. Agnes. No waiting room tonight — everybody gets seen at once. Escort the ambulance.'
  ]);
  add('intro_quarantine', [
    'Quarantine Zone. Lights out, gas coming in. Your flashlight\'s your best friend. I\'m your second best.',
    'Lou Vesper here. The Zone\'s dark, the fence is up, and the nests are breathing. Burn them.',
    'K-DED 88.1, The Last Signal, broadcasting to the Quarantine Zone. Stay in the light. Stay in the line.',
    'Night in the Zone, honey. Four nests, one flashlight, and a whole lot of glowing eyes.'
  ]);
  add('resume', [
    'And we\'re back on the air! Where were we? Ah yes. Surviving.',
    'Sorry, folks — generator hiccup. Lou\'s back. So are they.',
    'Signal restored. Did you miss me? They missed you.',
    'Back on 88.1! Pick up right where you left off, sugar.'
  ]);
  add('hello_rook', [
    'Is that Rook on the street? Officer, your shift ended years ago. Thanks for clocking back in.',
    'Rook\'s on patrol tonight. Badge is rusty, aim isn\'t. Ten shots, one stamp. You know the drill.',
    'Evening, Officer Rook. No paperwork tonight. Just the shooting part.'
  ]);
  add('hello_juno', [
    'Juno\'s out on the board tonight. Package delivered, zombies optional. Don\'t stop rolling.',
    'Our favourite courier is on the clock! Faster you move, faster she shoots. Physics, baby.',
    'Juno, honey, I know you don\'t brake. Just don\'t brake into anything with teeth.'
  ]);
  add('hello_tomas', [
    'Big Tomas is working the door tonight. Nobody gets in without a reservation. Nobody has one.',
    'Tomas, you magnificent wall. Every bite they take costs them. Let them pay.',
    'The Door is open for business. Well. Closed. That\'s the business.'
  ]);
  add('hello_ines', [
    'Dr. Vale, if you\'re listening: the lab\'s gone, but the hypothesis stands. Zombies conduct beautifully.',
    'Dr. Ines Vale on the air! Every critical hit jumps to the neighbours. Science is a team sport.',
    'Evening, Doctor. Bring the lightning. I\'ll bring the sarcasm.'
  ]);
  add('hello_mira', [
    'Mira\'s out there with her dogs. Somebody give that Scout a treat. Several treats.',
    'Ranger Mira and the good dogs are on the case. Dogs fetch, dogs bite, dogs are perfect.',
    'Mira, darling, tell Scout that Lou says hi. And good boy. Mostly good boy.'
  ]);
  add('hello_silas', [
    'Father Silas, bless this broadcast. And the generator. Especially the generator.',
    'The Father\'s walking the streets tonight. Holy water, steady feet, and a short temper for the dead.',
    'Evening, Father. Say one for me. Say two for them — they need it more.'
  ]);

  /* ---------------- listener call-ins ---------------- */
  add('callin_bodycount', [
    'Line one, it\'s Dale from the bowling alley. Dale wants a body count: {count} in 30 seconds.',
    'Caller wants numbers, {name}. {count} down in thirty. I\'ll keep the tally, you keep swinging.',
    'Request from Big Earl on the overpass: {count} rotters in thirty seconds. Earl\'s a simple man.',
    'We\'ve got a counter on the line! {count} kills, thirty seconds. Go make him lose count.'
  ]);
  add('callinWin_bodycount', [
    'That\'s {count}! Dale\'s screaming down the phone. Happily. I think.',
    'Body count complete! Earl says thank you. Earl is weeping. Here\'s your prize.',
    'Tally\'s in and it\'s ugly. Beautifully ugly. Crate\'s on its way.'
  ]);
  add('callinFail_bodycount', [
    'Short of the count, sugar. Dale hung up. Dale\'s got abandonment issues.',
    'Not quite {count}. The caller says "next time". The dead say "any time".',
    'Ran out of clock. Earl\'s disappointed. Earl\'s always disappointed. You\'re fine.'
  ]);
  add('callin_donttouch', [
    'Caller on line two says you look tired. Prove her wrong: don\'t get touched for 20 seconds.',
    'Tilly from the attic bets you can\'t go 20 seconds untouched. I bet you can. Don\'t lose me money.',
    'New request: twenty seconds, zero scratches. Keep it clean, {name}.',
    'Our caller wants elegance. Twenty seconds without a single bite. Dance, darling.'
  ]);
  add('callinWin_donttouch', [
    'Twenty seconds, not a scratch! Tilly owes me a tin of peaches. Your reward\'s bigger.',
    'Untouched! Untouchable! You\'re a ghost with a crate coming.',
    'Spotless. Do it again sometime when I\'m recording.'
  ]);
  add('callinFail_donttouch', [
    'Ooh, they got a bite in. Tilly\'s laughing at us. Rude.',
    'Touched! Scuffed! The caller is gloating. Ignore her, you\'re doing great.',
    'One little nibble and the bet\'s off. Shake it off, sugar.'
  ]);
  add('callin_boost', [
    'My signal\'s fading. There\'s a relay spot nearby — stand in the circle and boost me. Eight seconds.',
    'Antenna\'s crackling! Get to the marked spot and stand in it. Keep the signal alive. Keep ME alive.',
    'Listener says we\'re breaking up out east. Go stand in my circle, honey. Be my antenna.',
    'Station\'s losing juice. Find the broadcast circle, plant your feet. Eight seconds total.'
  ]);
  add('callinWin_boost', [
    'Signal\'s booming! I can hear myself in three counties. Thank you, human antenna.',
    'Boosted! Crystal clear on 88.1. Prize is yours.',
    'Oh, that\'s lovely reception. You\'re my favourite piece of equipment.'
  ]);
  add('callinFail_boost', [
    'Signal\'s still fuzzy. I sound like a ghost. Fitting, I suppose.',
    'Didn\'t quite boost it. Lou\'s going to be crackly for a while. Kshhh.',
    'Missed the window. The east end gets static tonight. They\'ll live. Some of them.'
  ]);
  add('callin_wanted', [
    'Got a tip from a caller: a big one with my tag on it. Drop it in 40 and I\'ll make it worth it.',
    'Wanted poster, freshly inked: one ugly elite, tagged and flagged. Bring it down in forty.',
    'Caller says this one ate her mailman. I\'ve tagged it. You know what to do.',
    'There\'s a bounty on the big tagged one, {name}. Forty seconds. Dead or deader.'
  ]);
  add('callinWin_wanted', [
    'Bounty collected! The mailman is avenged. Here\'s your reward.',
    'Tagged and bagged. Lovely work. Lou\'s sending the goods.',
    'That poster\'s coming down. Justice, apocalypse-style.'
  ]);
  add('callinFail_wanted', [
    'The tagged one\'s still walking. Wanted poster stays up. Maybe next time.',
    'It got away, sugar. Bounty\'s cancelled. The mailman remains un-avenged.',
    'Clock ran out on the bounty. That thing is out there, smug as anything.'
  ]);
  add('callin_special', [
    'Supply drop coming down about six hundred out. It\'s yours if you get there in 25. Fly, little bird.',
    'A caller with a plane and no fear just dropped a crate. Go get it before something else does.',
    'Special delivery, {name}! Crate on a parachute. Twenty-five seconds before the scavengers claim it.',
    'Gus from the airfield owes me a favour. That parachute? That\'s the favour. Run.'
  ]);
  add('callinWin_special', [
    'Delivery received! Sign here. Just kidding, nobody signs anything anymore.',
    'You got the drop! Gus will be thrilled. Gus is never thrilled.',
    'Package secured. Juno would be proud. Everyone would be proud.'
  ]);
  add('callinFail_special', [
    'Too slow, honey. Something with too many teeth got the crate.',
    'The drop\'s gone. Gus says he\'s not doing that again. Gus always says that.',
    'Missed the delivery. Lou will leave a note on the door. What door. Never mind.'
  ]);
  add('callin_keepmoving', [
    'Caller says if you stop, you drop. Keep moving for 25 seconds. Don\'t you dare stand still.',
    'Request from Gail at the roller rink: keep those feet going 25 seconds. No standing around.',
    'Twenty-five seconds of constant motion, honey. Think of it as dancing. Very sweaty dancing.',
    'A caller wants cardio! Keep moving, keep moving, keep moving. Twenty-five seconds.'
  ]);
  add('callinWin_keepmoving', [
    'Twenty-five seconds of hustle! Gail\'s giving you a free skate. And a crate.',
    'You never stopped! I got tired just watching. Reward incoming.',
    'Perpetual motion achieved. Physics is furious. Lou is delighted.'
  ]);
  add('callinFail_keepmoving', [
    'You stopped! Just for a second, but Gail saw. Gail sees everything.',
    'Feet planted, bet lost. Shake out those legs and try again next time.',
    'Ooh, a little pause there. The caller\'s calling it. Not your fault. Mostly.'
  ]);
  add('callin_noshortcuts', [
    'Purist on line three: no dashing for 40 seconds. Walk it like you mean it.',
    'Caller bets you lean on that dash. Prove him wrong. Forty seconds, feet on the ground.',
    'No shortcuts tonight, {name}. Forty seconds without a dash. Old-school survival.',
    'Professor Pemberton insists the dash is cheating. Forty seconds, no dashing. Humour him.'
  ]);
  add('callinWin_noshortcuts', [
    'Forty seconds, no shortcuts! The purist approves. He\'s sending something nice.',
    'Old-school legend. Pemberton is clapping. Slowly. Respectfully.',
    'You walked it. Every step. Lou salutes your calves.'
  ]);
  add('callinFail_noshortcuts', [
    'And there\'s the dash! The purist sighs heavily into the phone.',
    'Dashed! Couldn\'t help yourself. Honestly? I would have too.',
    'Shortcut taken. Pemberton is writing a strongly worded letter.'
  ]);
  add('callin_lucky', [
    'Lucky caller number nine wants crits! {count} critical hits in 20 seconds. Make \'em sing.',
    'Caller\'s feeling lucky. Land {count} crits in twenty and we all win. Mostly you.',
    'It\'s the lucky line! {count} crits, twenty seconds. Aim for the soft parts.',
    'Our caller rolled the dice and called you. {count} crits in twenty. Big numbers only.'
  ]);
  add('callinWin_lucky', [
    'Jackpot! {count} crits and counting. The lucky line pays out.',
    'Critical success! That\'s the luckiest thing I\'ve seen since the peach shipment.',
    'Lucky, lucky, lucky. Prize is on its way, sharpshooter.'
  ]);
  add('callinFail_lucky', [
    'Luck ran dry. Happens to the best of us. Happens to me hourly.',
    'Not enough crits, honey. The dice were loaded. Probably.',
    'Lucky line\'s closed. The caller says better luck next time. Literally.'
  ]);
  add('callinWin', [
    'Call-in complete! Crate, scrap and a little zap for your ultimate. Lou pays her debts.',
    'And we have a winner! Prize is yours, {name}.',
    'That\'s a wrap on the call-in. You make great radio.'
  ]);
  add('callinFail', [
    'No dice on that one. No penalty either. Lou\'s soft like that.',
    'Missed it. Don\'t sweat it, sugar — the phones never stop ringing.',
    'Call\'s over. You\'ll get the next one. I believe in you. Mostly.'
  ]);
  add('callinHurry', [
    'Clock\'s ticking on that call-in, sugar!',
    'Five seconds left on the line! Come on, come on!',
    'Caller\'s still holding! Hurry!',
    'Running out of time on the request — push!'
  ]);
  add('callinBusy', [
    'Phones are ringing off the hook, but the big one\'s still up. Callers can wait.',
    'Holding all calls until that monster\'s dead. Priorities.',
    'Lou\'s putting the callers on hold. Deal with the giant first.'
  ]);

  /* ---------------- player state ---------------- */
  add('lowHp', [
    'Hey. Hey. You\'re hurt bad. Breathe. Find some food, find some space. I\'m right here.',
    'Your heartbeat\'s louder than my music, {name}. Pull back. Heal up. Please.',
    'I\'ve lost a lot of listeners tonight. Not you. You hear me? Not you.',
    'Low on blood, high on spirit. Let\'s fix the first part. Look for cans, look for gaps.',
    'Easy, sweetheart. Dash out, catch your breath. The dead are patient. Be more patient.',
    'Stay with me, {name}. Just a little longer. You\'re doing better than you think.'
  ]);
  add('levelUp10', [
    'Level ten! You\'re not a survivor anymore, you\'re a problem. For them, I mean.',
    'Double digits, {name}! Level ten. The dead are starting to talk about you.',
    'Level ten. That\'s a lot of little green vials. Proud of you.'
  ]);
  add('levelUp20', [
    'Level twenty. At this point the zombies should be calling MY show for advice.',
    'Twenty levels deep! Somebody get this survivor a sponsorship deal.',
    'Level twenty, {name}. You\'re officially the scariest thing in {map}.'
  ]);
  add('levelUp30', [
    'Thirty! I\'d write you a song, but you\'re writing it yourself, one splat at a time.',
    'Level thirty. I\'ve run out of compliments. I\'m making new ones. Stupendo-licious.',
    'Thirty levels. Thirty! The dead have a word for you, and it\'s a swear word.'
  ]);
  add('levelUpHigh', [
    'Level {level}?! I didn\'t know the numbers went that high.',
    'Level {level}. You are a walking natural disaster. A nice one.',
    'Another level, {name}. You\'re rewriting the survival guide in real time.'
  ]);
  add('evolveFirst', [
    'Whoa — that\'s {evo}! First evolution of the night. The lab coats would be weeping.',
    'Hold on, did your weapon just EVOLVE? {evo}! Now we\'re cooking.',
    '{evo}! Lou\'s never seen hardware like that. First of many, I hope.'
  ]);
  add('evolve', [
    '{evo}! Somebody\'s been reading the manual.',
    'Another evolution — {evo}. You\'re building an arsenal out there.',
    '{evo} online. The dead just filed a complaint.',
    'Look at that. {evo}. Lou approves of excessive force.'
  ]);
  add('killMilestone', [
    '{kills} down! That\'s a whole town\'s worth. A small town. Getting bigger.',
    'Counter just ticked past {kills}. I need a bigger counter.',
    '{kills} kills, {name}. The graveyard\'s filing for an extension.',
    'That\'s {kills}. Lou\'s keeping score. Lou\'s keeping a very long score.'
  ]);
  add('noDamage', [
    'A whole minute without a scratch! Who taught you to move like that?',
    'Sixty seconds untouched. Show-off. Keep showing off.',
    'Not a single bite in a minute. They can\'t lay a finger on you, {name}.'
  ]);
  add('horde', [
    'That is a LOT of them. Like, a lot a lot. Find a lane.',
    'Your screen\'s more teeth than street right now, sugar. Keep cutting.',
    'Biggest crowd I\'ve seen since the county fair. Worse snacks, though.',
    'Okay, that horde\'s showing off. Show off harder.'
  ]);
  add('standStill', [
    'Standing still? Bold strategy. Lou recommends literally any other strategy.',
    'Feet, {name}. Use them. They\'re the things at the end of your legs.',
    'You\'re planted like a garden gnome out there. Gnomes get eaten.'
  ]);
  add('eliteKill', [
    'Big one down! Grab that crate before the neighbours do.',
    'That elite just got un-elited. Crate\'s on the ground, sugar.',
    'Nice takedown! That one had a fancy outline and everything.',
    'Elite down. Lou loves the sound of a big one hitting the pavement.'
  ]);
  add('jackpot', [
    'FIVE upgrades?! That crate was stuffed. Lady Luck\'s listening to 88.1.',
    'A five-reel crate! I heard the jingle from up here. Jackpot!',
    'Jackpot, {name}! Five upgrades. Don\'t spend it all in one apocalypse.'
  ]);
  add('perk', [
    'New perk! A new rule for the rest of the night. I like this rule.',
    'Ooh, good pick. Lou would have picked the same. Probably.',
    'Perk acquired. The dead didn\'t vote on that one.'
  ]);
  add('miniDown', [
    'Big one\'s down! Take a perk, take a breath, take a bow.',
    'You dropped it! That thing had a name and now it has a headstone.',
    'Miniboss down! Lou is doing a little dance on the water tower. Carefully.',
    'Down goes the bruiser! Grab the goodies, {name}.'
  ]);
  add('cleared', [
    'THAT\'S IT! The big one\'s dead! {name}, you absolute legend. K-DED is in your debt.',
    'It\'s down! It\'s actually down! {map} is going to sleep a little easier tonight.',
    'Headliner\'s dead! Fifteen minutes of hell and you won. Lou is crying. Happy tears.',
    'You did it, {name}. You killed the big one. I\'m playing your song on repeat.'
  ]);
  /* ---------------- map objectives ---------------- */
  add('objGenerator', [
    'Generator\'s humming! Street lights coming on in {map}. Grab the crate.',
    'That\'s one more generator purring. Lou can see your street from up here now.',
    'Power\'s back on that block! The dead hate a well-lit lawn.',
    'Generator online! Gloria sends her regards. Crate\'s yours.'
  ]);
  add('allGenerators', [
    'All three generators running! The whole grid\'s lit. Maple Hollow owes you a parade.',
    'Grid restored! Lights on every street. Have a Serum, you electrician of the apocalypse.',
    'Three for three! I can see the whole neighbourhood glowing. Beautiful work, {name}.'
  ]);
  add('objCheckpoint', [
    'Checkpoint cleared! Ambulance is still rolling. Keep it moving, sugar.',
    'That\'s a checkpoint. Siren\'s still wailing, engine\'s still running. Onward.',
    'Ambulance made it through! Grab the crate and stay close to that bumper.'
  ]);
  add('ambulanceDelivered', [
    'Ambulance delivered! Somebody at St. Agnes gets a second chance tonight. Have a Serum.',
    'Code Blue complete! You just did the most heroic parking job in history.',
    'The ambulance is out! I\'m playing the siren on the air. Wee-oo, {name}. Wee-oo.'
  ]);
  add('objNest', [
    'Nest\'s burning! Smells like victory. And roots. Mostly roots.',
    'One less nest breathing out there. Crate\'s on the ground, sugar.',
    'That nest just popped like a rotten melon. Lovely. Keep going.'
  ]);
  add('allNests', [
    'All four nests are ash! The Zone\'s quieter already. Here\'s a Serum for your trouble.',
    'Every nest burned! The Quarantine Zone just lost its heartbeat. Good riddance.',
    'Four for four, {name}! Nothing\'s breathing in those roots anymore.'
  ]);
  add('objective', [
    'Objective done! Crate and scrap, coming right up.',
    'That\'s one off the list. Lou\'s keeping a list. It\'s a short list.',
    'Nice work! Grab the goods before the neighbours do.'
  ]);

  add('evacLanded', [
    'Bird\'s on the pad. Stand in the ring to get out — or stick around and make my night.',
    'Chopper\'s down! Three seconds in the ring and you\'re gone. Or hold out for bonus scrap.',
    'Ride\'s here, sugar. Board it, or wave it off and keep the party going.',
    'Pad\'s hot, rotors spinning. Your choice: wheels up or Hold Out. Lou won\'t judge.'
  ]);
  add('evacLandedHold', [
    'Chopper\'s back on the ground. Thirty seconds. Your call, sugar.',
    'Ride\'s on the pad again. Bank it all or keep going, you maniac.',
    'Pad\'s open! Thirty seconds to cash out, {name}.'
  ]);
  add('holdMinute', [
    'Hold Out minute {k}. More scrap, more teeth. You\'re insane. I love it.',
    'That\'s minute {k} of overtime. The dead are getting meaner, and so are you.',
    'Minute {k}! Bonus scrap in the bank. Chopper\'s still on its loop.',
    '{k} minutes past closing time and still swinging. Lou\'s refilling the kettle.'
  ]);

  /* ---------------- survivor ult reactions ---------------- */
  add('ult_rook', [
    'Is that a gunship? Who authorised a gunship? Rook, I love you.',
    'Air support inbound! Somebody in the sky still owes Rook a favour.',
    'Rook called in the big guns. Like, literally. From the sky.'
  ]);
  add('ult_juno', [
    'Where did Juno get a motorbike? Doesn\'t matter. RIDE.',
    'Road Rage! Every rotter on that street just became a speed bump.',
    'Juno\'s on two wheels and zero brakes. Clear the road, dead folk!'
  ]);
  add('ult_tomas', [
    'LOCKDOWN. Tomas just became a building. Bring them in, big man.',
    'Tomas is calling every zombie over for a chat. The chat is a fist.',
    'The Door is closed! Nothing gets through. Everything gets punched.'
  ]);
  add('ult_ines', [
    'Dr. Vale just made it rain lightning. I felt that in my fillings.',
    'Overload! My console\'s sparking. Worth it.',
    'That\'s not weather, that\'s Ines. Strike, strike, strike!'
  ]);
  add('ult_mira', [
    'Release the hounds! Ghost dogs! Glowing ghost dogs! Best night ever.',
    'Mira just whistled up a spectral pack. Good dogs from beyond.',
    'Hounds out! Every dog in heaven just clocked in for a shift.'
  ]);
  add('ult_silas', [
    'Consecrate! Father Silas just turned the street into holy ground.',
    'That flash? That was Silas having a word with the Almighty. The Almighty agreed.',
    'Holy shockwave! Somebody say amen. Somebody say it louder.'
  ]);

  /* ---------------- idle chatter ---------------- */
  add('songs', [
    'Here\'s Marrow & the Moths with "Porchlight Lullaby". Slow dance with whatever\'s closest. Not that close.',
    'From the vault: Dolly Gravelle, "Two Hearts, One Bunker". My mother cried to this. Then she boarded the windows.',
    'Big Ruth & the Sandbags — "Barricade Boogie". Stack \'em high, honey. Stack \'em high.',
    'For the night shift: Juniper Vex, "Neon Quarantine". Turn it up. They\'re coming anyway.',
    'Lonesome Hank Velour with "My Truck Don\'t Start (And Neither Do I)". A true story, I\'m told.',
    'This is Crowbar Sweethearts, "Hold the Door For Me". For every door that held.',
    'The Low Tide Widows — "Salt in the Generator". Sabotage never sounded so sweet.',
    'Kid Formaldehyde, "Embalm Me Gently". A bit morbid. Everything\'s a bit morbid now.',
    'Up next, the Rusty Hinges Quartet with "Squeak Squeak, Darling". Hide in a closet and hear it live.',
    'Sister Tuesday — "Candles in the Pantry". For everybody rationing tonight.',
    'Doctor Kilowatt with "Short Circuit Sweetheart". Dr. Vale, I know you\'re humming along.',
    'Ossuary Bloom, "Petals on the Pavement". Prettier than what\'s actually on the pavement.',
    'Mister Moribund, "Slow Dance in the Bunker". Lights low, door bolted, hearts racing.',
    'The Gutter Cherubs, "Ambulance Chaser". Three chords and a siren. Punk\'s not dead. Punk\'s undead.',
    'Penny Ashgrove, "Postcard from the Overpass". She wrote it up there. She\'s still up there. Wave.',
    'The Cul-de-Sac Choir: "Lawn Ornament Love". Pink flamingos, broken hearts, plastic forever.',
    'Velma Thistle & the Undertow — "Undertow Waltz". Three-four time. Two-four if you\'re limping.',
    'A request for "Tin Can Telephone" by the Pocket Moons. Long-distance love, short-distance teeth.',
    'Here\'s Grandma Voltage and her Theremin Five: "Ghost in the Fusebox". Spooky. Appropriate.',
    'Cassidy Cinder, "Burn the Mailbox Down". Not a metaphor. Please don\'t actually.'
  ]);
  add('weather', [
    'Tonight\'s forecast: cloudy with a chance of teeth. Visibility poor. Morale poorer.',
    'Weather update: a warm front of rotting air moving in from the east. Breathe through your mouth.',
    'Low pressure over the cul-de-sac. High pressure on you. Scattered screaming through midnight.',
    'Seven-day outlook: night, night, night, night, a glimpse of sun on Thursday, then night.',
    'Pollen count is low. Zombie count is… let\'s say pollen would be preferable.',
    'Light drizzle, heavy footsteps. Bring an umbrella and something sharp.',
    'Humidity at ninety percent, sanity at forty. Winds gusting from the graveyard.',
    'Fog rolling in off the reservoir. If the fog groans, it\'s not fog.'
  ]);
  add('dedications', [
    'This one goes out to whoever left the lights on at 14 Birch Lane. We see you. So do they.',
    'Dedication from Marge on the hardware store roof: "Gerald, I\'m sorry about the ladder."',
    'Going out to the night nurses of St. Agnes, wherever you are. Especially if you\'re still on shift.',
    'To the kid with the shopping cart full of batteries: you\'re a legend. Share.',
    'From Ray in the bowling alley: "I\'m not coming out. Tell my wife lane seven is mine now."',
    'For my cat, Reverb, who hasn\'t left the console in three days. Neither have I.',
    'To the folks in the church basement playing cards by candlelight: deal me in next week.',
    'This one\'s for {name}. You know why. Keep doing exactly that.'
  ]);
  add('ads', [
    'K-DED is brought to you by Hal\'s Canned Peaches. They\'ll outlive you. That\'s not a threat.',
    'This hour sponsored by Wrenwood Hardware: plywood, nails and the quiet dignity of a boarded window.',
    'Brought to you by Sunny Acres Retirement Village. Now accepting anyone who can still knock.',
    'Static Cola: the taste of the last vending machine standing. Warm, flat, perfect.',
    'Feeling peckish? Mama Dot\'s Jerky — "So tough even THEY won\'t chew it."',
    'Gloria\'s Generators: she coughs, she sputters, she never quits. Unlike your neighbours.'
  ]);
  add('chatter', [
    'Still here? Good. Every minute you\'re alive is a minute I don\'t talk to myself.',
    'Fun fact: the dead can\'t climb ladders. Less fun fact: they keep trying.',
    'Reminder: those red marks on the ground? Don\'t stand in those. Lou loves you.',
    'Somebody keeps calling to ask if it\'s safe to come out. Darling, I live on a water tower.',
    'The generator out back is named Gloria. She coughs, she sputters, she keeps the music on. Be like Gloria.',
    'If you\'re just tuning in: the world ended Tuesday. We\'re running late on the follow-up.',
    'I\'ve been on the air for… what day is it? Doesn\'t matter. Clocks are a pre-apocalypse thing.',
    'Remember to hydrate. Not from the river. Never from the river.',
    'Yellow vials, blue vials — grab them all. Lou doesn\'t know what they are either.',
    'Quick poll: who still has all their fingers? Keep it that way.',
    'The phones never stop. Half are callers. The other half are just breathing. Heavily.',
    'You\'re listening to The Last Signal. If it isn\'t the last, I\'ll be very surprised.'
  ]);
  add('chatter_suburbs', [
    'Somewhere in Maple Hollow a sprinkler\'s still running. Bless that sprinkler.',
    'Homeowners\' association called. They\'d like you to stop leaving bodies on the lawns. I hung up.',
    'Every house on Elm has the same floor plan. Learn one, survive them all.',
    'Parked cars make great walls, {name}. Terrible getaway vehicles, but great walls.'
  ]);
  add('chatter_hospital', [
    'St. Agnes intercom still works. Somebody keeps paging Dr. Nobody to surgery. Don\'t answer.',
    'Hospital tip: the vending machine on floor two still takes coins. Live a little.',
    'Heard the cafeteria\'s serving jelly. Nobody\'s eating it. Nobody living, anyway.',
    'Watch the corridors, sugar. Long halls, short tempers.'
  ]);
  add('chatter_quarantine', [
    'Those floodlights out there? I paid good money for them. Okay, I stole them. Use them.',
    'Quarantine tip: if the dark breathes, run. If it glows, run faster.',
    'The fence was meant to keep them in. Now it keeps you in. Irony\'s a rough neighbour.',
    'Every explosion out there lights up the Zone for a second. Lou calls it fireworks.'
  ]);
  add('chat_rook', [
    'Rook, the precinct called. Just kidding. There\'s no precinct. There\'s just you.',
    'Every tenth shot, Rook. Count \'em. I count \'em. Ten is my favourite number now.',
    'Rook still reads people their rights before he shoots them. The dead don\'t appreciate it.'
  ]);
  add('chat_juno', [
    'Juno, your delivery rating is five stars. Your survival rating is… also five stars.',
    'Faster, Juno! Speed is ammunition! I made that up but it\'s true for you.',
    'Somebody tell Juno there\'s no tip. She\'s doing this for love.'
  ]);
  add('chat_tomas', [
    'Tomas, every bite they take, they pay for. Tell them about your cover charge.',
    'Big man\'s barely sweating. The zombies are, though. Metaphorically.',
    'Tomas once bounced a guy so hard he landed in the next county. True story. I was the guy.'
  ]);
  add('chat_ines', [
    'Dr. Vale, every crit you land jumps to the neighbours. Very neighbourly.',
    'Ines is running experiments out there. The control group is getting electrocuted.',
    'The Doctor\'s peer review process involves lightning. Lou approves.'
  ]);
  add('chat_mira', [
    'Mira\'s dogs fetch the goods straight to her. Teach Scout to fetch me a sandwich.',
    'Good dog count: unlimited. Bad zombie count: dropping.',
    'Mira, darling, if Scout runs off with a vial, that\'s a delivery. Let him work.'
  ]);
  add('chat_silas', [
    'Father Silas leaves a little mercy behind with every kill. Grab those blessings.',
    'The Father\'s footsteps glow. Walk behind him and you\'ll be fine. Walk in front and you won\'t.',
    'Silas, say a prayer for the generator. She\'s making a funny noise.'
  ]);

  /* ---------------- run end (also read by the meta agent's end screen) ---------------- */
  add('death', [
    'Signal lost… {name} went down swinging. Lou Vesper, K-DED. Keep a light on for them.',
    'We lost {name} out in {map} tonight. They made it {time}. That\'s more than most.',
    'Static on the line. {name}\'s gone quiet. Rest easy. We\'ll take it from here.',
    'That\'s the end of the broadcast for {name}. {kills} of them went first. Good night, sweetheart.',
    'Down in {map}. Lou\'s dimming the studio lights for a minute. Thank you, {name}.'
  ]);
  add('deathHold', [
    '{name} held out longer than anyone should. The chopper will miss you. I will too.',
    'Overtime ends for {name}. Half the bonus banked, all the respect earned.',
    'Hold Out\'s over. {name} stayed for the encore and the encore bit back.'
  ]);
  add('evac', [
    '{name} is in the air! Wheels up out of {map}. Sweetest sound on this frequency.',
    'Evac confirmed! {name} made it out with {kills} notches on the belt. Lou\'s so proud.',
    'Chopper\'s climbing, {name}\'s waving, and I\'m crying into the microphone. Beautiful.',
    'That\'s a clean getaway from {map}. K-DED signing off this chapter. Come back soon.'
  ]);
  add('evacHold', [
    '{name} cashed out after {k} minutes of Hold Out! Every scrap banked. You maniac.',
    'Overtime survivor {name} is airborne! The pilot wants your autograph.',
    'Wheels up after the encore! {name}, you\'re officially a legend of 88.1.'
  ]);
  add('quit', [
    'Signing off early? No shame. Lou will keep the frequency warm.',
    '{name} slips off the air. Come back when you\'re ready, sugar.',
    'Broadcast paused. The dead aren\'t going anywhere. Neither am I.'
  ]);

  /* ---------------- main menu banter (meta agent: DS.RADIO.menu) ---------------- */
  add('menu', [
    'You\'re listening to K-DED 88.1, The Last Signal. Pick a survivor. Pick a street. Pick a fight.',
    'Lou Vesper here, live from the water tower. Coffee\'s hot, the dead are not. Ready when you are.',
    'Requests line\'s open. Survival tips are free. Peaches are rationed.',
    'Still tuned in? Good. The night\'s young and so, technically, are you.',
    'Spend that scrap wisely, sugar. The Safehouse doesn\'t take IOUs.',
    'Reverb the cat says hi. Reverb also says go save somebody.',
    'Fifteen minutes. That\'s all you need to survive. And then a chopper. And then maybe more.',
    'K-DED: the only station still broadcasting. Ratings have never been better.',
    'The phones are lighting up. Everybody wants to know who\'s heading out next.',
    'Weather\'s terrible, music\'s great, odds are long. Sounds like a night out.',
    'Every run you take, I learn a little more about you. Mostly that you\'re stubborn. Good.',
    'Lou\'s tip of the hour: dash through the gap, not into the crowd.'
  ]);
})(DS.RADIO);

/* ---------------- line formatting ---------------- */
/* fills {placeholders}; unknown/empty ones become '' and double spaces collapse */
DS.radioFormat = function (line, world, extra) {
  if (!line) return '';
  if (line.indexOf('{') < 0) return line;
  const p = world && world.player, md = world && world.map && world.map.def;
  return String(line).replace(/\{(\w+)\}/g, (m, k) => {
    if (extra && extra[k] !== undefined && extra[k] !== null) return String(extra[k]);
    switch (k) {
      case 'name': return p && p.surv ? (p.surv.name || 'friend') : 'friend';
      case 'map': return md ? (md.short || md.name || 'town') : 'town';
      case 'kills': return world ? String(world.stats.kills) : '';
      case 'level': return p ? String(p.level) : '';
      case 'time': return world ? DS.fmtTime(world.t) : '';
      case 'k': return world ? String(Math.max(1, (world.holdT / 60) | 0)) : '';
      default: return '';
    }
  }).replace(/\s{2,}/g, ' ');
};

/* end-of-run line for the end screen (meta agent) — summary from world.over */
DS.radioEndLine = function (summary, world, rng) {
  const R = DS.RADIO; let key = 'death';
  if (summary) {
    if (summary.result === 'evac') key = summary.holdBonusRaw > 0 ? 'evacHold' : 'evac';
    else if (summary.result === 'quit') key = 'quit';
    else key = (world && world.holdOut) ? 'deathHold' : 'death';
  }
  const pool = R[key] && R[key].length ? R[key] : R.death;
  const i = rng ? rng.int(pool.length) : ((Math.random() * pool.length) | 0);
  return DS.radioFormat(pool[i], world, summary ? { kills: summary.kills, time: DS.fmtTime(summary.time) } : null);
};

/* integration: evolution crates unlock at DS.TUNE.evoMinTime */
DS.RADIO.evoReady = [
  'Drop crews just radioed in: crates are carrying prototypes now. Max a weapon, pair the gear, crack a crate.',
  'Six minutes in and the good stuff starts falling from the sky. Evolutions are live, folks.',
  'Supply runs just got interesting. Level-five weapon plus the right gear, then open a crate and pray.',
  'Lou\'s tip of the hour: crates can evolve your weapons now. The dead have no idea what\'s coming.'
];
DS.RADIO.bossEnrage = [
  'It\'s getting angrier. Finish it, or it finishes you.',
  'Oh, now it\'s mad. Two minutes of you poking it will do that.',
  'Listeners, it\'s gone red in the face. Whatever you\'ve got left, now\'s the time.',
  'That thing just found a second wind. Find yours.'
];
