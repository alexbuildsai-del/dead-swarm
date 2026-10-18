# Sound names (world.sound / DS.Audio.play)

Weapons: pistol akimbo saw_launch saw_hit buzzsaw drone_hit drone_laser sentry_deploy sentry_fire bunker_fire
laser_fence chainsaw reaper mortar_launch mortar_boom carpet_bomb tesla storm_grid cleaver_throw cleaver_hit
molotov_throw fire_ignite napalm boombox_drop boombox_boom block_beat bass_drop rocket_launch rocket_boom barrage
cryo_throw cryo_freeze flash_freeze shatter mine_drop mine_boom flamethrower dragon_breath holy_tick sanctuary smite
dog_bite dog_bark howl explosion

Survivor: hurt dash_roll dash_skate dash_charge dash_blink whistle dash_bless ult_air ult_bike ult_lockdown ult_emp
ult_hounds ult_consecrate levelup pickup_xp pickup_scrap pickup_food pickup_magnet grenade cryo_pickup crate_drop
crate_open reel_stop reel_jackpot evolve perk death revive heal shield_block

Zombies: groan groan_big sprinter_shriek bite zombie_die splat acid_lob acid_splash gas_burst bull_charge howl_buff
lurker_crack lurker_burst leap lash brood_spawn bile_spit mower gurney grab elite_spawn telegraph

Bosses: boss_roar boss_slam boss_charge boss_spray boss_spawn boss_phase boss_die boss_scream boss_blink boss_beam

UI / world: ui_click ui_back ui_buy ui_error achievement unlock event_warning siren radio_static radio_tune callin_ring
callin_win callin_fail gen_charge gen_done ambulance ambulance_break nest_die gas_warn heli evac holdout_tick wave_horn

Rate limits: every name must be rate-limited (e.g. ≤ 1 per 40 ms per name, ≤ 24 voices total) so a horde does not
turn into mush. Volume of positional sounds falls off with distance from the survivor.
