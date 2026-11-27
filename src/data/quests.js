// Quests: real-life island problems. Steps: talk | scan | visit | exp | holo | quiz | chain | choice
// Dialogue lines are [speaker, text]; speaker is an NPC id or 'you'.
const C = (title, prompt, cards, spark, outro) => ({ title, prompt, cards, spark, outro });
const choice = (npc, text, lines, options) => ({ type: 'choice', npc, text, lines, options });
const ok = (label, fb) => ({ label, ok: true, fb });
const no = (label, fb) => ({ label, ok: false, fb });

export const QUESTS = [
// ======================= LUMEN LAB PLAZA =======================
{ id: 'q_first_day', title: 'First Day at the Lumen Lab', zone: 'lab', giver: 'okafor', objectives: ['B1.1', 'B2.1', 'B2.2', 'C12.1'], xp: 120, auto: true,
  summary: 'Professor Okafor wants to know if you can tell living things from non-living ones — and see what life is made of.',
  intro: [['okafor', 'Welcome to Brightwater, {name}! I am Ada Okafor. The whole island is getting ready for the **Festival of Light**, and every district has a problem only science can solve.'],
    ['okafor', 'But first, the basics. Our old fig tree — is it alive? Prove it like a scientist. Scan it, then look at its cells under the microscope.'],
    ['you', 'A living tree, a microscope… sounds like a good first day.']],
  steps: [
    { type: 'scan', poi: 'lab_fig', text: 'Scan **the Old Fig Tree** beside the Lumen Lab (look for the glowing ◈).' },
    { type: 'exp', id: 'microscope', text: 'Use the **microscope** to view and measure cells.' },
    { type: 'quiz', subs: ['B1.1', 'B2.1', 'B2.2'], n: 3, text: 'Answer the Professor’s **3 questions** on living things and cells.' },
    choice('okafor', 'Report back to **Prof. Okafor**.', [['okafor', 'So, is the fig tree alive — and how do you know?']], [
      ok('Yes: it shows all seven life processes, and it is made of cells with walls, chloroplasts and nuclei.', 'Spot on. MRS GREN plus cells — that is the scientific answer.'),
      no('Yes, because it is green.', 'Lots of non-living things are green! You need evidence of the life processes.'),
      no('No — it doesn’t move, so it can’t be alive.', 'Plants move slowly: leaves turn to the light, flowers open. And movement is only one of seven processes.')]),
  ],
  outro: [['okafor', 'Excellent. Each idea you master becomes a star in the **Constellation of Knowledge** — look up tonight! Now, Brightwater needs you. Look for residents with a golden ◆.']] },

{ id: 'q_measure', title: 'The Clock Tower Pendulum', zone: 'lab', giver: 'mayor', requires: ['q_first_day'], objectives: ['P1.1', 'C12.1'], xp: 100,
  summary: 'The festival countdown clock runs slow. Its pendulum must swing with a period of exactly 2.0 seconds.',
  intro: [['mayor', 'Ah, the new scientist! Our countdown clock is running slow — the festival will start late at this rate!'], ['mayor', 'The clockmaker says the pendulum period should be exactly 2.0 s. Can you measure it accurately? One swing is too quick to time by hand.']],
  steps: [
    { type: 'exp', id: 'motion', goal: 'timing', text: 'In the **Motion Lab → Timing** bench, measure a pendulum period accurately.' },
    { type: 'quiz', subs: ['P1.1'], n: 3, text: 'Answer **3 questions** on measurement.' },
    choice('mayor', 'Tell **Mayor Brightwater** how to time the pendulum.', [['mayor', 'So how do I measure such a short swing?']], [
      ok('Time 20 complete swings with a stop-watch and divide by 20 — reaction-time errors become tiny.', 'Brilliant — the error is shared over 20 swings.'),
      no('Time one swing very carefully.', 'Human reaction time (~0.2 s) is a big fraction of one swing.'),
      no('Measure the length of the string with a ruler.', 'Length affects the period, but it is not a measurement of time.')]),
  ],
  outro: [['mayor', 'Twenty swings, divided by twenty… the clock is back on time! Thank you!']] },

{ id: 'q_atoms', title: 'Atoms of the Island', zone: 'lab', giver: 'okafor', requires: ['q_first_day'], objectives: ['C2.1', 'C2.2', 'C2.3', 'C8.1', 'C8.5', 'P5.1', 'C3.2'], xp: 160,
  summary: 'Prof. Okafor’s festival exhibit asks: what is everything on Brightwater made of?',
  intro: [['okafor', 'Sand, sea, sky, sandwiches — all made from fewer than a hundred kinds of atom. For the festival I want an exhibit that shows how atoms are built.'], ['okafor', 'Build some atoms in the Atom Forge, then explore the Periodic Table hologram.']],
  steps: [
    { type: 'exp', id: 'atoms', text: 'Build atoms, ions and isotopes in the **Atom Forge**.' },
    { type: 'holo', id: 'h_periodic', text: 'Explore the **Periodic Table** holo-model.' },
    { type: 'quiz', subs: ['C2.1', 'C2.2', 'C2.3', 'C8.1', 'C8.5'], n: 4, text: 'Answer **4 questions** on atoms and the Periodic Table.' },
    choice('okafor', 'Explain to **Prof. Okafor** what makes an element unique.', [['okafor', 'What decides which element an atom is?']], [
      ok('Its proton number — every atom with 6 protons is carbon, however many neutrons it has.', 'Exactly. Neutrons make isotopes; electrons make ions — protons make the element.'),
      no('Its number of neutrons.', 'Changing neutrons gives isotopes of the same element.'),
      no('Its mass number.', 'Isotopes of one element have different mass numbers.')]),
  ],
  outro: [['okafor', 'Protons for identity, electrons for chemistry. The exhibit is perfect.']] },

{ id: 'q_bonds', title: 'Salt, Sugar and Diamonds', zone: 'lab', giver: 'okafor', requires: ['q_atoms'], objectives: ['C2.4', 'C2.5', 'C2.6', 'C2.7', 'C3.1'], xp: 160,
  summary: 'Why does salty water conduct electricity but sugary water does not? Why is diamond hard and graphite slippery?',
  intro: [['okafor', 'A riddle for you: salt and sugar look alike, but only salt water conducts electricity. And diamond and pencil “lead” are both pure carbon!'], ['okafor', 'The answers are in how atoms bond. Try the Bond Builder.']],
  steps: [
    { type: 'exp', id: 'bonding', text: 'Make ionic, covalent, giant and metallic structures in the **Bond Builder**.' },
    { type: 'quiz', subs: ['C2.4', 'C2.5', 'C2.6', 'C2.7', 'C3.1'], n: 4, text: 'Answer **4 questions** on bonding and formulas.' },
    choice('okafor', 'Solve **Prof. Okafor’s** riddle.', [['okafor', 'Why does salt water conduct but sugar water not?']], [
      ok('Salt is ionic — dissolved ions are free to move and carry charge. Sugar is made of neutral covalent molecules.', 'Yes! Moving charged particles are needed for a current.'),
      no('Salt contains metal atoms that carry electrons through the water.', 'In solution the charge is carried by ions, not electrons.'),
      no('Sugar is too heavy to move.', 'Sugar molecules move freely — they just are not charged.')]),
  ],
  outro: [['okafor', 'Ions, molecules, giant lattices, metals — you see the hidden architecture of matter now.']] },

{ id: 'q_particles', title: 'Particles Everywhere', zone: 'lab', giver: 'okafor', thread: true, requires: ['q_first_day'], objectives: ['C1.1', 'C1.2', 'P2.1.1', 'P2.1.2', 'P2.1.3', 'P2.2.2', 'B3.1'], xp: 220,
  summary: 'Golden Thread — the particle model explains melting ice-cream, shrinking balloons and the smell of the bakery.',
  intro: [['okafor', 'This is a **Golden Thread** quest — one big idea that runs through biology, chemistry and physics. Today: particles.'], ['okafor', 'Why do festival balloons shrink at night? Why can you smell Lucia’s bakery from here? Same answer every time: tiny particles, always moving.']],
  steps: [
    { type: 'exp', id: 'particles', goal: 'states', text: 'Heat ice to steam in the **Particle Lab → States** and record the heating curve.' },
    { type: 'exp', id: 'particles', goal: 'gas', text: 'Investigate **gas pressure and volume** in the Particle Lab.' },
    { type: 'exp', id: 'particles', goal: 'diffusion', text: 'Race ammonia against hydrogen chloride in the **diffusion tube**.' },
    { type: 'chain', chain: C('Smelling the bakery', 'Put these in order to explain how the smell of fresh bread reaches you on the plaza.', [
      ['Hot bread releases scent molecules into the air as a gas', 'C1.1'], ['The molecules move fast and randomly — faster when warm', 'P2.1.2'],
      ['They collide with air molecules and spread out from high to low concentration', 'C1.2'], ['Some reach your nose and diffuse into the mucus on receptor cells', 'B3.1'],
      ['Receptors send impulses to your brain: “bread!”', 'B13.1']], ['C1.1~P2.1.2', 'C1.2~P2.1.2', 'B3.1~C1.2'], 'Particle motion is chemistry, physics and biology at once.'), text: 'Solve the **Smelling the Bakery** chain.' },
    choice('okafor', 'Explain the shrinking balloons to **Prof. Okafor**.', [['okafor', 'Why do the festival balloons shrink on a cold night?']], [
      ok('Colder gas particles move more slowly, hit the balloon wall less hard and less often, so the gas takes up less volume.', 'Perfect kinetic theory.'),
      no('The air particles shrink in the cold.', 'Particles do not change size — they slow down.'),
      no('Air leaks out at night.', 'They re-inflate when warmed — so no air was lost.')]),
  ],
  outro: [['okafor', 'You have pulled your first Golden Thread. Watch the constellation — threads glow gold.']] },

{ id: 'q_energy', title: 'Follow the Energy', zone: 'lab', giver: 'mayor', thread: true, requires: ['q_first_day'], objectives: ['P1.6.1', 'P1.6.2', 'P1.6.4', 'B18.1'], xp: 220,
  summary: 'Golden Thread — trace the energy behind a ride on the Ferris wheel all the way back to the Sun.',
  intro: [['mayor', 'For the festival brochure I want to answer one question: where does the energy for the Ferris wheel — and for the people riding it — really come from?'], ['mayor', 'Dr. Okafor says you can “follow the energy”. Show me!']],
  steps: [
    { type: 'exp', id: 'energy', text: 'Track energy stores on the **Energy Coaster** and measure work and power.' },
    { type: 'scan', poi: 'lab_ferris', text: 'Scan the **Festival Ferris Wheel**.' },
    { type: 'chain', chain: C('Follow the energy', 'Order the journey of energy from the Sun to you climbing the observatory steps.', [
      ['Nuclear fusion in the Sun releases energy', 'P6.2.1'], ['Light travels 150 million km to a wheat field on the island', 'P3.3'],
      ['Chlorophyll absorbs light; photosynthesis stores chemical energy in glucose', 'B6.1'], ['You eat bread made from that wheat', 'B18.2'],
      ['Respiration in your muscle cells releases the energy', 'B12.1'], ['Your muscles do work against gravity, raising your GPE', 'P1.6.2']], ['B18.1~P6.2.1', 'B6.1~P3.3', 'B6.1~P1.6.1', 'B12.1~P1.6.1'], 'From star to stairs — energy is transferred, never created or destroyed.'), text: 'Solve the **Follow the Energy** chain.' },
    { type: 'quiz', subs: ['P1.6.1', 'P1.6.2', 'P1.6.4'], n: 4, text: 'Answer **4 questions** on energy, work and power.' },
    choice('mayor', 'Give **the Mayor** her brochure headline.', [['mayor', 'So, what is the big idea for the brochure?']], [
      ok('Energy is never created or destroyed — it is transferred between stores, from the Sun’s nuclear store all the way to our kinetic store.', 'Conservation of energy — a perfect headline.'),
      no('The Ferris wheel makes its own energy.', 'Energy cannot be created.'),
      no('Energy gets used up on every ride.', 'It is transferred — mostly to thermal stores — not used up.')]),
  ],
  outro: [['mayor', '“From the Sun to your seat.” I love it!']] },

{ id: 'q_bungee', title: 'The Festival Bungee', zone: 'lab', giver: 'mayor', requires: ['q_first_day'], objectives: ['P1.5.1'], xp: 120,
  summary: 'A bungee tower is planned for the festival. The cords must be tested so they never pass their limit of proportionality.',
  intro: [['mayor', 'A bungee jump at the festival! The supplier sent cords, but I need someone to test how they stretch under load before anyone jumps.']],
  steps: [
    { type: 'exp', id: 'forces', goal: 'springs', text: 'Plot a **load–extension graph** in the Force Lab → Springs.' },
    { type: 'quiz', subs: ['P1.5.1'], n: 3, text: 'Answer **3 questions** on forces.' },
    choice('mayor', 'Advise **the Mayor** on cord safety.', [['mayor', 'How heavy a jumper can we allow?']], [
      ok('Keep the load below the limit of proportionality, where extension is still proportional to force (F = kx).', 'Beyond that point the cord may not return to its original length.'),
      no('Any weight — bungee cords stretch forever.', 'Every elastic material has a limit.'),
      no('Only the colour of the cord matters.', 'Safety depends on its spring constant and limit.')]),
  ],
  outro: [['mayor', 'Safe and springy. The bungee tower is approved!']] },

{ id: 'q_festival', title: 'The Festival of Light', zone: 'observatory', giver: 'mayor', requiresCount: 20, objectives: ['P6.2.1', 'P3.3', 'B6.1', 'C5.1', 'P1.6.3'], xp: 500, flag: 'festival',
  summary: 'The finale: relight the Lumen Beacon with everything you have learned and open the Festival of Light.',
  intro: [['mayor', 'Twenty problems solved — the island has never been in better shape. Tonight we open the **Festival of Light**!'], ['mayor', 'Prof. Okafor and Juno have one last puzzle at the beacon. Meet them at Observatory Hill.']],
  steps: [
    { type: 'visit', zone: 'observatory', text: 'Travel to **Observatory Hill**.' },
    { type: 'chain', chain: C('The Grand Connection', 'One beam of light ties the whole island together. Order the chain.', [
      ['Hydrogen nuclei fuse in the Sun’s core', 'P5.1'], ['Light and infrared radiate across space at 3 × 10⁸ m/s', 'P3.3'],
      ['Plants on Harvest Fields photosynthesise, storing chemical energy', 'B6.1'], ['Ancient plants became the fossil fuels in the old refinery', 'C11.3'],
      ['Today the wind turbines’ generators power the beacon lamp instead', 'P1.6.3'], ['The beacon’s lenses refract its light into a beam ships can see', 'P3.2.3']], ['P6.2.1~P5.1', 'P1.6.3~P6.2.1', 'B18.3~C11.3'], 'Every science is one story.'), text: 'Solve **the Grand Connection** at the beacon.' },
    choice('juno', 'Relight the beacon with **Juno**.', [['juno', 'Ready? Which energy resource should power the beacon tonight?'], ['okafor', 'Think about the whole island…']], [
      ok('The wind farm through the grid — renewable, no CO₂ while running, and the batteries cover calm spells.', 'A sustainable choice!'),
      no('The old diesel generator.', 'It works, but it pollutes the air Priya just cleaned up.'),
      no('Burning crude oil from the refinery.', 'That is neither renewable nor clean.')]),
  ],
  outro: [['juno', 'Look up — the Constellation of Knowledge is complete enough to light the way!'], ['mayor', 'Brightwater, the Festival of Light is OPEN!']] },

// ======================= OBSERVATORY =======================
{ id: 'q_beacon', title: 'Light the Beacon', zone: 'observatory', giver: 'juno', requires: ['q_first_day'], objectives: ['P3.2.1', 'P3.2.2', 'P3.2.3', 'P3.2.4'], xp: 200, flag: 'beacon_lens',
  summary: 'The Lumen Beacon’s mirrors and lenses were knocked out of alignment. Ships cannot see the island at night.',
  intro: [['juno', 'The beacon used to throw a beam 30 km out to sea. A storm knocked its mirrors and lenses out of place.'], ['juno', 'Before we realign them, practise on the light bench: reflection, refraction, lenses and prisms.']],
  steps: [
    { type: 'scan', poi: 'obs_beacon', text: 'Scan **the Lumen Beacon**.' },
    { type: 'exp', id: 'optics', text: 'Master reflection, refraction, lenses and dispersion on the **Light Bench**.' },
    { type: 'quiz', subs: ['P3.2.1', 'P3.2.2', 'P3.2.3', 'P3.2.4'], n: 4, text: 'Answer **4 questions** on light.' },
    choice('juno', 'Tell **Juno** where to put the lamp.', [['juno', 'Where must the lamp sit so the converging lens sends out a parallel beam?']], [
      ok('Exactly at the principal focus of the lens.', 'Rays from the focus leave the lens parallel to the axis.'),
      no('As close to the lens as possible.', 'Inside the focal length the rays spread out.'),
      no('At twice the focal length.', 'That forms a same-size real image, not a parallel beam.')]),
  ],
  outro: [['juno', 'Aligned! The beacon will shine again once the island’s knowledge — and power — are restored.']] },

{ id: 'q_stargazers', title: 'Stargazers', zone: 'observatory', giver: 'juno', requires: ['q_beacon'], objectives: ['P6.1', 'P6.2.1', 'P6.2.2', 'P6.2.3'], xp: 200,
  summary: 'Juno is planning a festival star party and needs a guide who understands the Solar System and the life of stars.',
  intro: [['juno', 'For the festival I am running a star party. People always ask: how far away is that star? Will the Sun explode?'], ['juno', 'Help me build the answers.']],
  steps: [
    { type: 'scan', poi: 'obs_sundial', text: 'Scan the **Sundial**.' },
    { type: 'exp', id: 'space', text: 'Explore the **Orrery & Stars** simulation.' },
    { type: 'holo', id: 'h_stars', text: 'Study the **Life of Stars** holo-model.' },
    { type: 'quiz', subs: ['P6.1', 'P6.2.1', 'P6.2.2', 'P6.2.3'], n: 4, text: 'Answer **4 questions** on space.' },
    choice('juno', 'Answer the star-party question for **Juno**.', [['juno', 'A child asks: “Will the Sun explode as a supernova?”']], [
      ok('No — the Sun is a medium-mass star. It will become a red giant, then a white dwarf in a planetary nebula.', 'Only massive stars become supernovae.'),
      no('Yes, all stars explode.', 'Low- and medium-mass stars end quietly as white dwarfs.'),
      no('It will become a black hole next year.', 'The Sun is not massive enough, and it has billions of years left.')]),
  ],
  outro: [['juno', 'You would make a fine astronomer. See you under the stars.']] },

// ======================= POWER & WORKS =======================
{ id: 'q_lights_out', title: 'Lights Out on Market Street', zone: 'market', giver: 'rosa', requires: ['q_first_day'], objectives: ['P4.2.1', 'P4.2.2', 'P4.2.3', 'P4.2.4', 'P4.2.5', 'P4.3.1', 'P4.3.2'], xp: 240, flag: 'lights_fixed',
  summary: 'When one lamp on Market Street failed, every lamp went dark. And the fuel truck keeps giving people static shocks.',
  intro: [['rosa', 'Rosa Alvarez, electrician. Somebody rewired the Market Street lamps last week and now when one bulb blows, the whole street goes dark.'], ['rosa', 'And the fuel truck keeps zapping my apprentice! Let’s sort out both — current electricity and static.']],
  steps: [
    { type: 'scan', poi: 'mkt_streetlamp', text: 'Scan a **flickering street lamp** on Market Street.' },
    { type: 'exp', id: 'circuits', goal: 'build', text: 'Build series and parallel circuits in the **Circuit Builder**.' },
    { type: 'exp', id: 'circuits', goal: 'static', text: 'Investigate **static charge** in the Circuit Builder.' },
    { type: 'quiz', subs: ['P4.2.2', 'P4.2.3', 'P4.2.4', 'P4.3.1', 'P4.3.2'], n: 4, text: 'Answer **4 questions** on circuits.' },
    choice('rosa', 'Tell **Rosa** how to rewire the street.', [['rosa', 'How should the lamps be wired?']], [
      ok('In parallel — each lamp gets the full voltage and has its own branch, so one failure does not break the others.', 'Exactly how houses are wired too.'),
      no('In series, but with brighter bulbs.', 'In series, one break still stops the current to every lamp.'),
      no('With no switch at all.', 'That would not stop the chain failure.')]),
  ],
  outro: [['rosa', 'Parallel it is. And I’ll earth that fuel truck. Market Street will glow tonight!']] },

{ id: 'q_teo', title: 'Mr. Teo’s Kitchen', zone: 'market', giver: 'teo', requires: ['q_lights_out'], objectives: ['P4.4', 'P4.2.5'], xp: 160,
  summary: 'Mr. Teo’s old kettle keeps blowing the fuse — and he wants to know what his electricity costs.',
  intro: [['teo', 'Every time I boil my kettle the whole house goes dark and the fuse box clicks. In my day I would have stuck a nail in the fuse…'], ['you', 'Please don’t do that! Let me investigate safely.']],
  steps: [
    { type: 'exp', id: 'circuits', goal: 'home', text: 'Find the hazards in the **Home Wiring** simulation.' },
    { type: 'chain', chain: C('Why the fuse blew', 'Order the fault that keeps tripping Mr. Teo’s electrics.', [
      ['Water leaked inside the old kettle’s metal casing', 'P4.4'], ['The live wire now touches the metal case through the water', 'P4.4'],
      ['A large current rushes through the earth wire to the ground', 'P4.2.2'], ['The current is far above the fuse rating, and heats the fuse wire', 'P4.2.4'],
      ['The fuse melts, breaking the circuit — the case never becomes live', 'P4.4']], ['P4.2.4~P4.4', 'C9.2~P4.4'], 'The fuse and earth wire saved Mr. Teo from a shock.'), text: 'Solve **Why the fuse blew**.' },
    choice('teo', 'Advise **Mr. Teo**.', [['teo', 'So what should I do, young scientist?']], [
      ok('Replace the faulty kettle. Never bypass a fuse — it and the earth wire just protected you from a shock.', 'Safety first.'),
      no('Fit a bigger fuse so it stops blowing.', 'A larger fuse would let a dangerous current flow.'),
      no('Remove the earth wire.', 'Then the case could become live and electrocute you.')]),
  ],
  outro: [['teo', 'A new kettle it is. And I’ll leave the fuses alone, promise!']] },

{ id: 'q_power', title: 'Power the Festival', zone: 'power', giver: 'kofi', requires: ['q_first_day'], objectives: ['P1.6.3', 'P4.5.1', 'P4.5.2', 'P4.5.6'], xp: 280, flag: 'grid_fixed',
  summary: 'The grid cannot meet festival demand, so the dirty diesel backup is running day and night.',
  intro: [['kofi', 'Kofi Mensah, chief engineer. The festival will need twice our normal power, the turbines are disconnected and that diesel backup is coughing smoke over the island.'], ['kofi', 'Design a better energy mix, and learn how a generator and transformer really work.']],
  steps: [
    { type: 'scan', poi: 'pow_turbine', text: 'Scan a **wind turbine**.' },
    { type: 'exp', id: 'grid', text: 'Balance supply and demand in the **Island Power Grid** simulator.' },
    { type: 'exp', id: 'electromag', goal: 'generator', o: ['P4.5.1', 'P4.5.2'], text: 'Spin a coil in the **Electromagnetism Lab → Generator**.' },
    { type: 'exp', id: 'electromag', goal: 'transformer', o: ['P4.5.6'], text: 'Step voltages up and down in the **Transformer** bench.' },
    { type: 'chain', chain: C('From wind to kettle', 'Order the journey from a breezy hillside to boiling water in town.', [
      ['The Sun heats land and sea unevenly, creating wind', 'P1.6.3'], ['Moving air turns the blades — kinetic energy', 'P1.6.1'],
      ['A coil spins in a magnetic field, inducing an alternating e.m.f.', 'P4.5.2'], ['A step-up transformer raises the voltage, lowering the current', 'P4.5.6'],
      ['Low current means little I²R heating loss in the cables', 'P4.2.5'], ['In a kettle, current heats the element: electrical → thermal energy', 'P4.4']], ['P1.6.3~P4.5.2', 'P4.5.6~P4.2.5', 'P1.6.3~P6.2.1'], 'Sunlight → wind → induction → tea.'), text: 'Solve **From wind to kettle**.' },
    choice('kofi', 'Explain the grid to **Kofi**.', [['kofi', 'Why do we transmit at 33 000 volts instead of 230?']], [
      ok('For the same power, high voltage means low current, and heat lost in cables (P = I²R) falls dramatically.', 'That is why pylons exist.'),
      no('High voltage travels faster.', 'Electrical energy transfer speed is not the reason.'),
      no('Homes need 33 000 V.', 'A step-down transformer reduces it to 230 V for homes.')]),
  ],
  outro: [['kofi', 'Turbines online, diesel off! Listen to that — silence and clean air.']] },

{ id: 'q_ferris', title: 'The Ferris Wheel Motor', zone: 'lab', giver: 'kofi', requires: ['q_power'], objectives: ['P4.1', 'P4.5.3', 'P4.5.4', 'P4.5.5'], xp: 200, flag: 'ferris_fixed',
  summary: 'The festival Ferris wheel’s electric motor will not turn. Time to understand magnets and motors.',
  intro: [['kofi', 'With the power back, there is one more job: the Ferris wheel motor is dead. Its magnets may be weak, or the commutator is worn.'], ['kofi', 'Learn how a motor turns electricity into motion.']],
  steps: [
    { type: 'scan', poi: 'lab_ferris', text: 'Scan the **Ferris Wheel**.' },
    { type: 'exp', id: 'electromag', goal: 'magnets', text: 'Map magnetic fields in **Electromagnetism → Magnets**.' },
    { type: 'exp', id: 'electromag', goal: 'motor', o: ['P4.5.4', 'P4.5.5'], text: 'Get a **d.c. motor** spinning.' },
    { type: 'quiz', subs: ['P4.1', 'P4.5.3', 'P4.5.4', 'P4.5.5'], n: 4, text: 'Answer **4 questions** on magnetism and motors.' },
    choice('kofi', 'Diagnose the motor for **Kofi**.', [['kofi', 'The coil twitches but will not keep turning. Why?']], [
      ok('The split-ring commutator is worn — it must reverse the current every half turn to keep the coil rotating one way.', 'Exactly the fault!'),
      no('The magnets are too strong.', 'Stronger magnets increase the turning effect.'),
      no('Motors need alternating current.', 'This is a d.c. motor with a commutator.')]),
  ],
  outro: [['kofi', 'New commutator, and she turns! First ride is yours.']] },

{ id: 'q_metal', title: 'Metal Works', zone: 'power', giver: 'kofi', requires: ['q_first_day'], objectives: ['C9.1', 'C9.2', 'C9.3', 'C9.6', 'C4.1', 'C4.2', 'C2.7'], xp: 260,
  summary: 'New steel for the festival stage, aluminium for the bus — and a hydrogen fuel cell to replace the diesel bus.',
  intro: [['kofi', 'We need steel for the festival stage and aluminium panels for the bus. Where do metals come from, and why do some need electricity to make?'], ['kofi', 'And the new island bus runs on a hydrogen fuel cell. Learn both.']],
  steps: [
    { type: 'holo', id: 'h_blastfurnace', text: 'Explore the **Blast Furnace** holo-model.' },
    { type: 'exp', id: 'electrolysis', text: 'Run the **Electrolysis Cell** and the **fuel cell**.' },
    { type: 'quiz', subs: ['C9.1', 'C9.2', 'C9.3', 'C9.6', 'C4.1'], n: 4, text: 'Answer **4 questions** on metals.' },
    { type: 'chain', chain: C('From rock to rail', 'Order how hematite ore becomes a hard steel stage frame.', [
      ['Hematite (iron(III) oxide) ore is mined', 'C9.6'], ['Coke burns; carbon dioxide is reduced to carbon monoxide', 'C9.6'],
      ['Carbon monoxide removes oxygen from the iron oxide — reduction', 'C6.3'], ['Molten iron is alloyed with carbon and chromium to make steel', 'C9.3'],
      ['Different-sized atoms stop the metal layers sliding — the frame is hard', 'C2.7']], ['C6.3~C9.6', 'C9.3~C2.7'], 'Reduction makes the metal; alloying makes it strong.'), text: 'Solve **From rock to rail**.' },
    choice('kofi', 'Answer **Kofi’s** question.', [['kofi', 'Why can’t we make aluminium in the blast furnace like iron?']], [
      ok('Aluminium is more reactive than carbon, so carbon cannot reduce its oxide — it must be extracted by electrolysis.', 'The reactivity series decides the method.'),
      no('Aluminium melts too easily.', 'The problem is chemical reactivity.'),
      no('There is no aluminium ore.', 'Bauxite is aluminium ore.')]),
  ],
  outro: [['kofi', 'Steel for the stage, aluminium for the bus. You think like an engineer.']] },

// ======================= HARBOUR =======================
{ id: 'q_rust', title: 'Rust Never Sleeps', zone: 'harbour', giver: 'marisol', requires: ['q_first_day'], objectives: ['C9.4', 'C9.5', 'C6.3'], xp: 220, flag: 'rust_fixed',
  summary: 'The pier’s steel legs are rusting fast. Captain Marisol wants them protected before the festival crowds arrive.',
  intro: [['marisol', 'Captain Marisol Reyes. My pier legs are rusting away and the anchor chain looks like cornflakes. Salt water is merciless.'], ['marisol', 'The old harbour master bolted zinc blocks to the legs. Were they right?']],
  steps: [
    { type: 'scan', poi: 'har_pier', text: 'Scan **the pier supports**.' },
    { type: 'scan', poi: 'har_anchor', text: 'Scan **the rusty anchor**.' },
    { type: 'exp', id: 'rusting', text: 'Find what makes iron rust in the **Rust Investigation**.' },
    { type: 'exp', id: 'reactivity', goal: 'displacement', text: 'Rank the metals in **Metal Reactivity → Displacement**.' },
    { type: 'chain', chain: C('Zinc saves the pier', 'Order how the zinc blocks protect the steel.', [
      ['Salt water and air reach the steel legs', 'C9.5'], ['Zinc is higher than iron in the reactivity series', 'C9.4'],
      ['Zinc atoms lose electrons more readily — zinc is oxidised first', 'C6.3'], ['The zinc corrodes instead of the iron (sacrificial protection)', 'C9.5']], ['C9.5~C9.4', 'C9.5~C6.3'], 'The zinc sacrifices itself for the steel.'), text: 'Solve **Zinc saves the pier**.' },
    choice('marisol', 'Advise **Captain Marisol**.', [['marisol', 'So what do I do about my pier?']], [
      ok('Replace the worn zinc blocks regularly and paint the steel above the waterline — sacrificial plus barrier protection.', 'Both methods together.'),
      no('Use copper blocks instead of zinc.', 'Copper is less reactive than iron — it would make the steel rust faster.'),
      no('Nothing — rust protects the iron underneath.', 'Rust flakes off, exposing fresh iron.')]),
  ],
  outro: [['marisol', 'Fresh zinc and fresh paint. My pier will outlive me!']] },

{ id: 'q_sink', title: 'Sink or Swim', zone: 'harbour', giver: 'marisol', requires: ['q_first_day'], objectives: ['P1.3', 'P1.4', 'P1.7'], xp: 180,
  summary: 'The ferry is overloaded for the festival, and the beach rescue buggy keeps sinking into the sand.',
  intro: [['marisol', 'Two problems. The ferry sits too low with festival cargo, and the lifeguards’ new buggy sinks into soft sand.'], ['marisol', 'Density and pressure, I am told. Over to you.']],
  steps: [
    { type: 'scan', poi: 'har_cargo', text: 'Scan **the cargo ferry**.' },
    { type: 'exp', id: 'density', goal: 'density', text: 'Measure densities in the **Density & Pressure Lab**.' },
    { type: 'exp', id: 'density', goal: 'pressure', text: 'Investigate **pressure = force ÷ area**.' },
    { type: 'quiz', subs: ['P1.3', 'P1.4', 'P1.7'], n: 4, text: 'Answer **4 questions** on mass, density and pressure.' },
    choice('marisol', 'Fix the **buggy** problem.', [['marisol', 'How do we stop the buggy sinking?']], [
      ok('Fit wide, low-pressure tyres — the same weight over a bigger area gives less pressure on the sand.', 'Like snowshoes!'),
      no('Make the buggy lighter by removing its seats.', 'It helps a little, but area is the big lever.'),
      no('Pump the tyres harder.', 'Harder tyres have a smaller contact area — more pressure.')]),
  ],
  outro: [['marisol', 'Wide tyres and a lighter load. Everything floats as it should.']] },

{ id: 'q_crane', title: 'Balancing Act', zone: 'harbour', giver: 'marisol', requires: ['q_sink'], objectives: ['P1.5.2', 'P1.5.3'], xp: 180,
  summary: 'The dockside crane must lift the festival stage without toppling into the harbour.',
  intro: [['marisol', 'The festival stage arrives in one heavy crate. If the crane lifts it too far out, the whole thing could tip into the water.']],
  steps: [
    { type: 'scan', poi: 'har_crane', text: 'Scan **the dockside crane**.' },
    { type: 'exp', id: 'forces', goal: 'moments', text: 'Balance a beam in **Force Lab → Moments**.' },
    { type: 'exp', id: 'forces', goal: 'cog', text: 'Test stability in **Force Lab → Centre of gravity**.' },
    { type: 'quiz', subs: ['P1.5.2', 'P1.5.3'], n: 3, text: 'Answer **3 questions** on moments and stability.' },
    choice('marisol', 'Brief **the crane operator**.', [['marisol', 'The crate is twice as heavy as usual. What should we do?']], [
      ok('Lift it closer to the tower so its moment is no bigger than the counterweight’s — and keep the centre of gravity over the base.', 'Principle of moments keeps it upright.'),
      no('Lift it further out so it swings less.', 'Further out means a bigger moment — more likely to topple.'),
      no('Remove the counterweight to save weight.', 'The counterweight provides the balancing moment!')]),
  ],
  outro: [['marisol', 'Stage delivered without a splash. Bravo!']] },

{ id: 'q_depths', title: 'Sounding the Depths', zone: 'harbour', giver: 'kai', requires: ['q_first_day'], objectives: ['P3.4', 'P3.1'], xp: 220,
  summary: 'Kai needs to chart the harbour depth with an echo sounder, and understand why waves spread through the harbour gap.',
  intro: [['kai', 'Hey! Kai, diver and lifeguard. The festival boats need a depth chart, and our echo sounder needs calibrating.'], ['kai', 'Also, why do waves spread out after the harbour entrance? Let’s learn waves properly.']],
  steps: [
    { type: 'scan', poi: 'har_boat', text: 'Scan **the echo sounder** on the fishing boat.' },
    { type: 'exp', id: 'sound', text: 'Explore pitch, loudness and echoes in the **Sound Studio**.' },
    { type: 'scan', poi: 'har_gap', text: 'Scan **the harbour entrance** from the end of the pier.' },
    { type: 'exp', id: 'waves', text: 'Make waves reflect, refract and diffract in the **Ripple Tank**.' },
    { type: 'chain', chain: C('Measuring depth with sound', 'Order how the echo sounder measures the depth of the harbour.', [
      ['A transducer vibrates, producing an ultrasound pulse', 'P3.4'], ['The longitudinal wave travels down through the sea water', 'P3.1'],
      ['It reflects off the seabed — an echo', 'P3.4'], ['The time for the round trip is measured precisely', 'P1.1'],
      ['depth = speed × time ÷ 2', 'P1.2']], ['P3.1~P3.4', 'P1.1~P1.2'], 'Sound waves turned into a map.'), text: 'Solve **Measuring depth with sound**.' },
    choice('kai', 'Work out the depth with **Kai**.', [['kai', 'The echo returns after 0.02 s. Sound moves at 1500 m/s in sea water. How deep is it?']], [
      ok('15 m — the pulse travels 30 m there and back, so the depth is half of 1500 × 0.02.', 'Spot on.'),
      no('30 m.', 'That is the total distance there and back — halve it.'),
      no('75 000 m.', 'Multiply speed by time, don’t divide.')]),
  ],
  outro: [['kai', 'Depth chart done. You’re a natural at sea.']] },

{ id: 'q_freshwater', title: 'Fresh Water from the Sea', zone: 'harbour', giver: 'kai', requires: ['q_first_day'], objectives: ['C10.1', 'C12.4', 'C8.3', 'B10.1'], xp: 260, flag: 'water_fixed',
  summary: 'The desalination plant has failed. The plaza fountain is dry and the clinic is worried about waterborne disease.',
  intro: [['kai', 'Bad news: the desalination plant broke down. We’re rationing water and the plaza fountain is dry.'], ['kai', 'Dr. Chen is worried about cholera if people drink untreated water. Can you help get clean water flowing?']],
  steps: [
    { type: 'scan', poi: 'har_desal', text: 'Scan **the desalination plant**.' },
    { type: 'exp', id: 'water', text: 'Run the **Water Treatment** plant and test water purity.' },
    { type: 'exp', id: 'reactivity', goal: 'halogens', text: 'Compare **chlorine, bromine and iodine** in Metal Reactivity → Halogens.' },
    { type: 'chain', chain: C('Cholera-proof water', 'Order how sea water becomes safe drinking water.', [
      ['Sea water is heated: water evaporates, salts stay behind', 'C12.4'], ['The vapour condenses in a cool condenser — pure water', 'P2.2.2'],
      ['Chlorine, a Group VII element, is added to kill microbes', 'C8.3'], ['Pathogens can no longer spread through the water supply', 'B10.1']], ['C12.4~P2.2.2', 'C8.3~C10.1', 'B10.1~C10.1'], 'Chemistry and physics preventing disease.'), text: 'Solve **Cholera-proof water**.' },
    choice('kai', 'Check the water with **Kai**.', [['kai', 'How do we prove the water from the plant is pure?']], [
      ok('Pure water boils at exactly 100 °C and freezes at exactly 0 °C — impurities change these values.', 'Sharp, fixed points mean purity.'),
      no('It looks clear, so it is pure.', 'Dissolved salts and microbes are invisible.'),
      no('Pure water turns anhydrous copper sulfate blue.', 'That shows water is present, not that it is pure.')]),
  ],
  outro: [['kai', 'Clean water flowing — and listen, the fountain is back!']] },

// ======================= MARKET STREET =======================
{ id: 'q_bread', title: 'The Bread That Wouldn’t Rise', zone: 'market', giver: 'lucia', requires: ['q_first_day'], objectives: ['B12.1', 'B5.1', 'C11.6'], xp: 220, flag: 'bread_fixed',
  summary: 'Lucia’s festival loaves came out flat after a cold night. Is her yeast dead?',
  intro: [['lucia', 'Disaster! I need 500 loaves for the festival and this morning’s batch is flat as a pancake.'], ['lucia', 'The heater in my proving cabinet broke last night. Is the yeast dead? Please investigate!']],
  steps: [
    { type: 'scan', poi: 'mkt_oven', text: 'Scan **the proving cabinet**.' },
    { type: 'exp', id: 'yeast', text: 'Find the best temperature for yeast in the **Fermentation Station**.' },
    { type: 'chain', chain: C('Why the bread stayed flat', 'Order what happened to Lucia’s dough overnight.', [
      ['The kitchen cooled to 10 °C overnight', 'P2.1.2'], ['Yeast enzymes and sugar molecules collided less often and with less energy', 'B5.1'],
      ['Yeast respiration slowed down', 'B12.1'], ['Much less carbon dioxide gas was produced', 'B12.1'],
      ['Few gas bubbles formed, so the dough stayed flat', 'C1.1']], ['C6.2~P2.1.2', 'B5.1~C6.2', 'B12.1~C11.6'], 'Cold slows the enzymes — the yeast was alive all along!'), text: 'Solve **Why the bread stayed flat**.' },
    { type: 'quiz', subs: ['B12.1', 'B5.1'], n: 3, text: 'Answer **3 questions** on respiration and enzymes.' },
    choice('lucia', 'Explain it to **Lucia**.', [['lucia', 'So — is my yeast dead?']], [
      ok('No! It was just too cold. Prove the dough at about 35 °C so the yeast’s enzymes work fast and release lots of CO₂.', 'Warm, not hot — above ~45 °C the enzymes denature.'),
      no('Yes, the cold killed it. Buy new yeast.', 'Cold only slows yeast down; it recovers when warmed.'),
      no('Prove it in the oven at 90 °C to speed it up.', 'That would denature the enzymes and kill the yeast.')]),
  ],
  outro: [['lucia', 'Fixed heater, perfect loaves! Smell that? That’s ethanol and CO₂ — the smell of success.']] },

{ id: 'q_lunchbox', title: 'Lunchbox Detective', zone: 'market', giver: 'sam', requires: ['q_first_day'], objectives: ['B4.1', 'B7.1', 'B7.2', 'B7.3'], xp: 220,
  summary: 'Sam is designing the Fun Run athletes’ lunch menu and needs to know what is really in each food.',
  intro: [['sam', 'Coach Tomás wants a proper athletes’ lunch for the Fun Run. Balanced, he says — but I’m a coffee guy!'], ['sam', 'Can you test what’s in my foods and explain how the body digests them?']],
  steps: [
    { type: 'scan', poi: 'mkt_fruit', text: 'Scan **the fruit & veg stall**.' },
    { type: 'exp', id: 'foodtests', text: 'Test foods for starch, sugar, protein and fat in the **Food Detective** lab.' },
    { type: 'holo', id: 'h_digestive', text: 'Follow a sandwich through the **Digestive System** holo-model.' },
    { type: 'quiz', subs: ['B4.1', 'B7.1', 'B7.2', 'B7.3'], n: 4, text: 'Answer **4 questions** on diet and digestion.' },
    choice('sam', 'Plan the menu with **Sam**.', [['sam', 'What makes a balanced athlete’s lunch?']], [
      ok('Starchy carbohydrate for energy, protein for repair, some fat, fruit and veg for vitamins, minerals and fibre — and water.', 'Balanced and race-ready.'),
      no('Just protein shakes.', 'Athletes need carbohydrate for energy, plus vitamins and fibre.'),
      no('Only sugary drinks for quick energy.', 'That lacks protein, vitamins, minerals and fibre.')]),
  ],
  outro: [['sam', 'Menu sorted. I might even eat it myself!']] },

{ id: 'q_stains', title: 'Stain Busters', zone: 'market', giver: 'iris', requires: ['q_first_day'], objectives: ['B5.1', 'B7.3'], xp: 160,
  summary: 'Iris’s festival costumes are covered in egg and grass stains. Biological washing powder failed in a boiling wash.',
  intro: [['iris', 'My costumes! Egg, gravy, grass — and the “biological” powder did nothing. I even boiled them to be sure!'], ['you', 'Boiled them? I think I know what went wrong…']],
  steps: [
    { type: 'exp', id: 'enzymes', text: 'Test amylase at different temperatures and pH in the **Enzyme Lab**.' },
    { type: 'quiz', subs: ['B5.1'], n: 3, text: 'Answer **3 questions** on enzymes.' },
    choice('iris', 'Explain the failed wash to **Iris**.', [['iris', 'Why didn’t the powder work?']], [
      ok('Its enzymes were denatured by boiling — their active sites changed shape. Wash at about 40 °C instead.', 'Enzymes have an optimum temperature.'),
      no('Enzymes only work in cold water.', 'Cold water just slows them down.'),
      no('The powder ran out of enzymes because they were used up.', 'Enzymes are catalysts — they are not used up.')]),
  ],
  outro: [['iris', '40 degrees… and the stains are gone! You’re a costume saviour.']] },

{ id: 'q_heartburn', title: 'Heartburn Help', zone: 'market', giver: 'omar', requires: ['q_first_day'], objectives: ['C7.1', 'C12.2', 'C3.3', 'C12.1'], xp: 220,
  summary: 'Omar wants to know which antacid neutralises the most stomach acid per tablet.',
  intro: [['omar', 'Omar Haddad, pharmacist. Festival food means festival heartburn. I stock two antacids and customers ask which is stronger.'], ['omar', 'A titration would settle it. Can you run one?']],
  steps: [
    { type: 'scan', poi: 'mkt_antacid', text: 'Scan **the antacid shelf**.' },
    { type: 'exp', id: 'titration', text: 'Titrate in the **Titration Lab**.' },
    { type: 'quiz', subs: ['C7.1', 'C12.2', 'C3.3'], n: 4, text: 'Answer **4 questions** on acids, bases and titration.' },
    choice('omar', 'Report to **Omar**.', [['omar', 'How do we know when the acid is exactly neutralised?']], [
      ok('The indicator changes colour at the end-point — then we read the burette and compare volumes.', 'Concordant titres give a fair comparison.'),
      no('When the flask gets warm.', 'Neutralisation is exothermic, but temperature is not a precise end-point.'),
      no('When bubbles stop forming.', 'An indicator shows the end-point precisely.')]),
  ],
  outro: [['omar', 'Tablet B neutralises 40% more acid. I’ll update my labels!']] },

{ id: 'q_fizz', title: 'Faster Fizz', zone: 'market', giver: 'omar', requires: ['q_heartburn'], objectives: ['C6.2', 'C5.1'], xp: 180,
  summary: 'Customers want a faster-acting indigestion remedy. Powder or tablet? Warm or cold water?',
  intro: [['omar', 'Customers complain my tablets work too slowly. Should I sell powder instead? Should they use warm water?']],
  steps: [
    { type: 'exp', id: 'rates', text: 'Investigate the **rate of reaction** of marble chips and acid.' },
    { type: 'quiz', subs: ['C6.2'], n: 3, text: 'Answer **3 questions** on rates.' },
    choice('omar', 'Advise **Omar**.', [['omar', 'Powder or tablet?']], [
      ok('Powder — a larger surface area means more frequent collisions with the acid, so it reacts faster.', 'Collision theory!'),
      no('Tablet — bigger pieces react faster.', 'Smaller pieces expose more surface.'),
      no('It makes no difference.', 'Surface area strongly affects rate.')]),
  ],
  outro: [['omar', 'Powder sachets it is!']] },

{ id: 'q_pharmacy', title: 'Mislabelled Jars', zone: 'market', giver: 'omar', requires: ['q_heartburn'], objectives: ['C12.5', 'C8.4', 'B14.1'], xp: 220,
  summary: 'A delivery of chemical salts arrived with the labels washed off. Omar also wants a leaflet on antibiotics.',
  intro: [['omar', 'Rain soaked my delivery and every label washed off. I can’t sell unknown powders!'], ['omar', 'Identify them with chemical tests — and help me with an antibiotics leaflet.']],
  steps: [
    { type: 'exp', id: 'analysis', text: 'Identify the unknowns in the **Chemical Detective** lab.' },
    { type: 'quiz', subs: ['C12.5', 'B14.1'], n: 4, text: 'Answer **4 questions** on chemical tests and antibiotics.' },
    choice('omar', 'Finish **Omar’s** leaflet.', [['omar', 'A customer wants antibiotics for flu. What should the leaflet say?']], [
      ok('Antibiotics kill bacteria but not viruses like flu. Overusing them breeds resistant bacteria.', 'Clear and correct.'),
      no('Antibiotics cure all infections.', 'They do nothing against viruses.'),
      no('Take antibiotics just in case.', 'That speeds up resistance.')]),
  ],
  outro: [['omar', 'Every jar relabelled, and a leaflet the doctor approves of!']] },

{ id: 'q_coffee', title: 'Self-Heating Coffee', zone: 'market', giver: 'sam', requires: ['q_first_day'], objectives: ['C5.1', 'C6.1'], xp: 180,
  summary: 'Sam wants self-heating coffee cans for the festival — and instant cold packs for the first-aid tent.',
  intro: [['sam', 'Big idea: self-heating coffee cans! Twist the base, and it’s hot. And Dr. Chen wants instant cold packs for sprains.'], ['sam', 'Which reactions do what?']],
  steps: [
    { type: 'exp', id: 'energetics', text: 'Measure temperature changes in the **Hot & Cold Reactions** lab.' },
    { type: 'quiz', subs: ['C5.1', 'C6.1'], n: 3, text: 'Answer **3 questions** on energy changes.' },
    choice('sam', 'Advise **Sam**.', [['sam', 'Which reaction goes in the coffee can?']], [
      ok('An exothermic one — it transfers thermal energy to the surroundings, so the temperature rises.', 'And an endothermic one for the cold pack.'),
      no('An endothermic one.', 'Endothermic reactions take in energy — they get cold.'),
      no('Any physical change.', 'You need a strongly exothermic chemical reaction.')]),
  ],
  outro: [['sam', 'Hot coffee, cold packs. The festival is going to be very comfortable!']] },

{ id: 'q_crystals', title: 'Crystal Clear', zone: 'market', giver: 'iris', requires: ['q_first_day'], objectives: ['C7.2', 'C7.3', 'C10.1'], xp: 200,
  summary: 'Iris wants to grow sparkling blue crystals for festival jewellery — and keep them blue.',
  intro: [['iris', 'Look at these blue crystals! I want hundreds for festival jewellery. But when I warmed some, they went white and crumbly. Help!']],
  steps: [
    { type: 'scan', poi: 'mkt_crystals', text: 'Scan **the crystal display**.' },
    { type: 'exp', id: 'salts', text: 'Make and test salts in the **Salt Workshop**.' },
    { type: 'quiz', subs: ['C7.2', 'C7.3'], n: 3, text: 'Answer **3 questions** on oxides and salts.' },
    choice('iris', 'Explain to **Iris**.', [['iris', 'Why did my crystals turn white?']], [
      ok('Heating drove off the water of crystallisation — blue hydrated copper(II) sulfate became white anhydrous copper(II) sulfate.', 'Add water and they turn blue again.'),
      no('The copper burned away.', 'The copper is still there.'),
      no('They melted.', 'They lost water; they did not melt.')]),
  ],
  outro: [['iris', 'No more heating my jewellery! These will sparkle all festival.']] },

{ id: 'q_ticket', title: 'The Forged Ticket', zone: 'market', giver: 'mayor', requires: ['q_first_day'], objectives: ['C12.3', 'C12.4'], xp: 180,
  summary: 'Fake festival tickets are circulating. The real ones are signed with a special pen. Forensic chemistry time!',
  intro: [['mayor', 'Scandal! Forged festival tickets. The genuine ones are signed with a special purple festival pen.'], ['mayor', 'Can you prove which pen signed this fake?']],
  steps: [
    { type: 'scan', poi: 'mkt_booth', text: 'Scan **the ticket booth**.' },
    { type: 'exp', id: 'chromatography', text: 'Analyse the inks by **paper chromatography**.' },
    { type: 'quiz', subs: ['C12.3', 'C12.4'], n: 3, text: 'Answer **3 questions** on separation techniques.' },
    choice('mayor', 'Present the evidence to **the Mayor**.', [['mayor', 'Is the ticket genuine?']], [
      ok('No — its ink separates into a pattern that matches pen C, not the festival pen; the spots have different Rf values.', 'Case closed.'),
      no('Yes — both inks are purple.', 'Similar colours can be different mixtures of dyes.'),
      no('We cannot tell with chemistry.', 'Chromatography separates the dyes so they can be compared.')]),
  ],
  outro: [['mayor', 'Pen C… I know who owns that! Thank you, detective.']] },

{ id: 'q_fireworks', title: 'Festival Fireworks', zone: 'market', giver: 'iris', requires: ['q_first_day'], objectives: ['C8.2', 'C12.5', 'C2.2', 'C8.4'], xp: 240, flag: 'fireworks',
  summary: 'Iris is designing the festival fireworks. Which metals make which colours — and why are some metals stored under oil?',
  intro: [['iris', 'I’m designing the fireworks finale! Red, yellow, lilac, blue-green… which metal ions do I need?'], ['iris', 'And why do the suppliers keep sodium and potassium under oil?']],
  steps: [
    { type: 'scan', poi: 'mkt_fireworks', text: 'Scan **the firework crate**.' },
    { type: 'exp', id: 'analysis', goal: 'flame', text: 'Run **flame tests** in the Chemical Detective lab.' },
    { type: 'exp', id: 'reactivity', goal: 'water', text: 'Drop Group I metals into water in **Metal Reactivity**.' },
    { type: 'chain', chain: C('Colour in the sky', 'Order how a firework makes its colour.', [
      ['Metal salts are packed into the firework', 'C2.4'], ['The explosion is strongly exothermic, heating the metal ions', 'C5.1'],
      ['Electrons in the ions are excited to higher shells', 'C2.2'], ['As they drop back, they emit light of a particular colour — like a flame test', 'C12.5'],
      ['Each colour is a particular part of the visible spectrum', 'P3.2.4']], ['C12.5~P3.2.4', 'C8.2~C12.5'], 'Every firework is a giant flame test.'), text: 'Solve **Colour in the sky**.' },
    choice('iris', 'Answer **Iris**.', [['iris', 'Why store potassium under oil?']], [
      ok('Group I metals are so reactive they react with oxygen and water vapour in air — potassium is even more reactive than sodium.', 'Reactivity increases down Group I.'),
      no('To keep it shiny for display.', 'It is a safety measure.'),
      no('Because it is a liquid.', 'Potassium is a soft solid.')]),
  ],
  outro: [['iris', 'Lithium red, sodium yellow, potassium lilac, copper blue-green… watch the sky at night!']] },

{ id: 'q_chill', title: 'The Big Chill', zone: 'market', giver: 'sam', requires: ['q_first_day'], objectives: ['P2.2.1', 'P2.3.1', 'P2.3.2', 'P2.3.3', 'P2.3.4'], xp: 220,
  summary: 'Sam’s ice-cream cart melts its stock by noon. Can physics keep it frozen?',
  intro: [['sam', 'My ice-cream cart is a puddle factory by midday. I need it to survive a full festival day.']],
  steps: [
    { type: 'scan', poi: 'mkt_icecream', text: 'Scan **the ice-cream cart**.' },
    { type: 'exp', id: 'thermal', text: 'Investigate conduction, convection, radiation and expansion in the **Heat Transfer Lab**.' },
    { type: 'chain', chain: C('Keeping ice cream frozen', 'Order how a well-designed cart keeps out thermal energy.', [
      ['Sunlight — visible and infrared — hits the cart', 'P2.3.3'], ['A white, shiny lid reflects most of the radiation', 'P2.3.3'],
      ['Foam walls full of trapped air conduct very little heat', 'P2.3.1'], ['A tight seal stops warm air convection currents getting in', 'P2.3.2'],
      ['The ice cream’s particles keep vibrating in fixed positions — it stays solid', 'P2.1.2']], ['P2.3.1~P2.3.4', 'P2.3.2~P2.3.4', 'P2.3.3~P3.3'], 'Block all three routes and the ice cream survives.'), text: 'Solve **Keeping ice cream frozen**.' },
    choice('sam', 'Redesign the cart with **Sam**.', [['sam', 'What colour should I paint the new cart?']], [
      ok('White or silver — light, shiny surfaces are poor absorbers and good reflectors of radiation.', 'Plus foam walls and a good seal.'),
      no('Black, so it looks cool.', 'Black is the best absorber of radiation — it would melt faster.'),
      no('Colour makes no difference.', 'Colour strongly affects radiation absorbed.')]),
  ],
  outro: [['sam', 'White cart, foam walls, tight lid. Ice cream until sunset!']] },

// ======================= CLINIC & SPORTS =======================
{ id: 'q_funrun', title: 'The Festival Fun Run', zone: 'clinic', giver: 'tomas', requires: ['q_first_day'], objectives: ['B9.2', 'B11.1', 'B12.1'], xp: 240,
  summary: 'Coach Tomás is training runners for the Fun Run and wants to explain what exercise does to the body.',
  intro: [['tomas', 'Coach Tomás! The Fun Run is coming and half my runners collapse panting after 400 m.'], ['tomas', 'Help me understand what’s happening inside them — heart, lungs and muscles.']],
  steps: [
    { type: 'scan', poi: 'cln_track', text: 'Scan **the running track**.' },
    { type: 'exp', id: 'body', goal: 'exercise', text: 'Measure heart rate and breathing in the **Body Lab → Exercise**.' },
    { type: 'holo', id: 'h_lungs', text: 'Explore the **Lungs & Alveoli** holo-model.' },
    { type: 'chain', chain: C('The sprinter’s oxygen debt', 'Order what happens to a sprinter during and after a race.', [
      ['Leg muscles contract hard, needing lots of energy', 'B12.1'], ['Heart rate and breathing rate rise to deliver more oxygen', 'B9.2'],
      ['Oxygen cannot be supplied fast enough, so muscles respire anaerobically', 'B12.1'], ['Lactic acid builds up in the muscles and blood', 'B12.1'],
      ['After the race, deep breathing supplies oxygen to break down the lactic acid', 'B11.1']], ['B9.2~B12.1', 'B11.1~B12.1'], 'Panting after a race is the body repaying its oxygen debt.'), text: 'Solve **The sprinter’s oxygen debt**.' },
    choice('tomas', 'Advise **Coach Tomás**.', [['tomas', 'Why do they keep panting after they stop?']], [
      ok('They are repaying an oxygen debt — extra oxygen is needed to break down the lactic acid made by anaerobic respiration.', 'A proper warm-down helps too.'),
      no('Their lungs are too small.', 'Breathing stays high to supply oxygen for removing lactic acid.'),
      no('They breathed in too much carbon dioxide.', 'Their muscles produced the extra CO₂.')]),
  ],
  outro: [['tomas', 'I’ll teach them to pace themselves. Science on the track!']] },

{ id: 'q_heart', title: 'Heart of the Matter', zone: 'clinic', giver: 'mei', requires: ['q_first_day'], objectives: ['B9.1', 'B9.2', 'B9.3', 'B9.4'], xp: 240,
  summary: 'Dr. Chen is preparing a heart-health stall: how the heart, vessels and blood work — and how to avoid heart disease.',
  intro: [['mei', 'Dr. Mei Chen. I’m running a heart-health stall at the festival. Islanders keep asking how the heart works and what blood is made of.'], ['mei', 'Will you help me prepare?']],
  steps: [
    { type: 'scan', poi: 'cln_ecg', text: 'Scan **the ECG monitor**.' },
    { type: 'holo', id: 'h_heart', text: 'Explore the beating **Heart & Circulation** holo-model.' },
    { type: 'exp', id: 'microscope', goal: 'blood', text: 'Identify red and white blood cells under the **microscope** (choose the blood smear).' },
    { type: 'quiz', subs: ['B9.1', 'B9.2', 'B9.3', 'B9.4'], n: 4, text: 'Answer **4 questions** on the circulatory system.' },
    choice('mei', 'Answer a stall visitor with **Dr. Chen**.', [['mei', 'A visitor asks how to lower their risk of coronary heart disease.']], [
      ok('Eat less saturated fat and salt, exercise regularly and don’t smoke — this keeps coronary arteries clear.', 'Diet and exercise are key.'),
      no('Eat more fatty food for energy.', 'Saturated fat contributes to blocked arteries.'),
      no('Avoid exercise to rest the heart.', 'Regular exercise strengthens the heart.')]),
  ],
  outro: [['mei', 'The stall is ready. You explain the heart beautifully.']] },

{ id: 'q_outbreak', title: 'Outbreak!', zone: 'clinic', giver: 'mei', requires: ['q_first_day'], objectives: ['B10.1', 'B14.1', 'B15.5'], xp: 260,
  summary: 'A stomach bug is spreading before the festival. Dr. Chen needs a plan to stop it — and health-fair leaflets.',
  intro: [['mei', 'A stomach bug is going round the island, and the festival will bring hundreds of visitors. We need to break the chain of infection.'], ['mei', 'We also run a health fair on vaccines and sexual health. Let’s get the science right.']],
  steps: [
    { type: 'scan', poi: 'cln_sanitiser', text: 'Scan **the hand sanitiser station**.' },
    { type: 'scan', poi: 'cln_poster', text: 'Scan **the vaccination poster**.' },
    { type: 'holo', id: 'h_immune', text: 'Watch the **Immune Defence** holo-model.' },
    { type: 'chain', chain: C('How a vaccine stops an outbreak', 'Order how vaccination protects a whole community.', [
      ['Harmless antigens from a weakened pathogen are injected', 'B10.1'], ['Lymphocytes make antibodies with a complementary shape', 'B9.4'],
      ['Memory cells stay in the blood for years', 'B10.1'], ['On real infection, antibodies are made fast — before illness', 'B10.1'],
      ['Fewer people catch and pass on the disease', 'B10.1']], ['B9.4~B10.1'], 'Vaccines protect people who cannot be vaccinated too.'), text: 'Solve **How a vaccine stops an outbreak**.' },
    { type: 'quiz', subs: ['B10.1', 'B14.1', 'B15.5'], n: 4, text: 'Answer **4 questions** on disease and immunity.' },
    choice('mei', 'Plan with **Dr. Chen**.', [['mei', 'What is our first action against the stomach bug?']], [
      ok('Hand-washing stations, safe food preparation and clean water — break the transmission routes.', 'Hygiene stops indirect transmission.'),
      no('Give everyone antibiotics.', 'If it is viral, antibiotics will not help — and they breed resistance.'),
      no('Cancel the festival.', 'Good hygiene is enough to control the spread.')]),
  ],
  outro: [['mei', 'Sanitiser on every stall and a cracking health fair. Thank you.']] },

{ id: 'q_reflexes', title: 'Lightning Reflexes', zone: 'clinic', giver: 'tomas', requires: ['q_first_day'], objectives: ['B13.1', 'B13.2'], xp: 180,
  summary: 'The island’s goalkeeper wants faster reactions. What limits reaction time?',
  intro: [['tomas', 'Our goalkeeper, Ana, keeps diving too late. Can we measure her reaction time and understand how nerves work?']],
  steps: [
    { type: 'exp', id: 'body', goal: 'reaction', text: 'Measure reaction times in **Body Lab → Reaction**.' },
    { type: 'holo', id: 'h_nervous', text: 'Explore the **Nervous & Hormone Systems** holo-model.' },
    { type: 'quiz', subs: ['B13.1', 'B13.2'], n: 3, text: 'Answer **3 questions** on coordination.' },
    choice('tomas', 'Explain to **Coach Tomás**.', [['tomas', 'Why is a reflex faster than Ana’s reaction to a shot?']], [
      ok('A reflex arc goes through a relay neurone in the spinal cord, skipping conscious decision-making in the brain.', 'Fewer, faster steps.'),
      no('Reflexes use hormones, which are faster.', 'Hormones are slower — they travel in the blood.'),
      no('Reflexes don’t use neurones.', 'They use sensory, relay and motor neurones.')]),
  ],
  outro: [['tomas', 'We’ll train her to read the striker earlier. Thanks, doc — I mean, scientist!']] },

{ id: 'q_heatstroke', title: 'Too Hot to Handle', zone: 'clinic', giver: 'mei', requires: ['q_funrun'], objectives: ['B13.3', 'P2.2.2', 'P2.3.3'], xp: 220,
  summary: 'A runner collapsed with heat exhaustion in training. How does the body control its temperature?',
  intro: [['mei', 'One of Tomás’s runners overheated in the midday sun. On race day it will be hotter still.'], ['mei', 'Let’s understand how the body keeps itself at 37 °C.']],
  steps: [
    { type: 'scan', poi: 'cln_heat', text: 'Scan **the heat warning sign**.' },
    { type: 'holo', id: 'h_skin', text: 'Explore the **Skin & Homeostasis** holo-model.' },
    { type: 'chain', chain: C('Cooling a runner', 'Order how a runner’s body cools down.', [
      ['Muscles respire fast, releasing extra thermal energy', 'B12.1'], ['Temperature receptors detect the rise; the brain responds', 'B13.1'],
      ['Sweat glands release sweat onto the skin', 'B13.3'], ['The most energetic water molecules evaporate, cooling the skin', 'P2.2.2'],
      ['Vasodilation sends blood near the surface to radiate infrared', 'P2.3.3']], ['B13.3~P2.2.2', 'B13.3~P2.3.3', 'B13.1~B13.3', 'B12.1~C5.1'], 'Biology uses physics to stay cool.'), text: 'Solve **Cooling a runner**.' },
    { type: 'quiz', subs: ['B13.3', 'P2.2.2'], n: 3, text: 'Answer **3 questions** on homeostasis and evaporation.' },
    choice('mei', 'Advise the runners with **Dr. Chen**.', [['mei', 'Why is a humid day more dangerous than a dry one?']], [
      ok('Sweat evaporates slowly in humid air, so it cools the body much less.', 'Drink water and rest in shade.'),
      no('Humid air is hotter than dry air.', 'At the same temperature, humidity matters because of evaporation.'),
      no('The body stops sweating in humidity.', 'Sweat still forms; it just does not evaporate.')]),
  ],
  outro: [['mei', 'Water stations every kilometre. No more collapses on my watch.']] },

{ id: 'q_scanner', title: 'Inside the Scanner', zone: 'clinic', giver: 'mei', requires: ['q_first_day'], objectives: ['P3.3', 'P5.1', 'P5.2.1', 'P5.2.2', 'P5.2.3', 'P5.2.4', 'P5.2.5', 'C2.3'], xp: 300,
  summary: 'The clinic’s new radiology suite uses X-rays and radioactive tracers. Staff need to understand the risks.',
  intro: [['mei', 'Our new radiology suite opens next month: X-rays, a gamma camera, even radioactive tracers. The staff are nervous.'], ['mei', 'Help me write the safety training — what radiation is, and how to work with it safely.']],
  steps: [
    { type: 'scan', poi: 'cln_xray', text: 'Scan **the radiology suite**.' },
    { type: 'holo', id: 'h_spectrum', text: 'Explore the **Electromagnetic Spectrum** holo-model.' },
    { type: 'exp', id: 'radioactivity', text: 'Test alpha, beta and gamma and measure half-life in the **Radiation Lab**.' },
    { type: 'chain', chain: C('Tracing a tumour', 'Order how a radioactive tracer helps doctors see inside the body.', [
      ['A radioactive isotope is attached to a tracer and injected', 'C2.3'], ['Its unstable nuclei decay, emitting gamma rays', 'P5.2.3'],
      ['Gamma rays are EM waves that pass out through the body', 'P3.3'], ['A detector outside counts the gamma rays to build an image', 'P5.2.1'],
      ['A short half-life means the tracer soon stops emitting', 'P5.2.4']], ['C2.3~P5.1', 'P3.3~P5.2.2', 'P5.2.4~P5.2.5'], 'Nuclear physics saving lives.'), text: 'Solve **Tracing a tumour**.' },
    { type: 'quiz', subs: ['P5.2.2', 'P5.2.4', 'P5.2.5', 'P3.3'], n: 4, text: 'Answer **4 questions** on radiation.' },
    choice('mei', 'Finish the training with **Dr. Chen**.', [['mei', 'What are the three rules for working safely with radiation?']], [
      ok('Minimise time, maximise distance and use shielding such as lead.', 'Time, distance, shielding.'),
      no('Wear sunglasses and sunscreen.', 'They do not stop ionising radiation.'),
      no('Radiation in hospitals is always harmless.', 'Ionising radiation can cause mutations and cancer.')]),
  ],
  outro: [['mei', 'The staff feel confident now. That’s real public health work.']] },

{ id: 'q_arrivals', title: 'New Arrivals', zone: 'clinic', giver: 'mei', requires: ['q_first_day'], objectives: ['B15.2', 'B15.4', 'B16.1'], xp: 200,
  summary: 'Dr. Chen’s antenatal class wants to understand how a baby begins — from gametes to inheritance of sex.',
  intro: [['mei', 'I run an antenatal class for parents-to-be. They always ask: how does a single cell become a baby, and what decides if it’s a boy or a girl?']],
  steps: [
    { type: 'holo', id: 'h_reproduction', text: 'Explore the **Human Reproduction** holo-model.' },
    { type: 'quiz', subs: ['B15.2', 'B15.4', 'B16.1'], n: 4, text: 'Answer **4 questions** on reproduction and inheritance.' },
    choice('mei', 'Answer the parents with **Dr. Chen**.', [['mei', 'What decides the baby’s sex?']], [
      ok('The sperm: an egg always carries an X chromosome; a sperm carries either X or Y. XX is female, XY is male.', 'It is a 50 : 50 chance each time.'),
      no('The mother’s diet.', 'Sex is decided by chromosomes at fertilisation.'),
      no('The egg decides.', 'Every egg carries an X.')]),
  ],
  outro: [['mei', 'The class loved it. Science, warmly explained.']] },

{ id: 'q_speed', title: 'Speed Trap', zone: 'clinic', giver: 'tomas', requires: ['q_first_day'], objectives: ['P1.2', 'P1.5.1'], xp: 220,
  summary: 'Coach Tomás is timing sprints and the festival go-kart race. What do the motion graphs reveal?',
  intro: [['tomas', 'For the go-kart race and the sprint, I want proper motion graphs — speed, acceleration, the lot.'], ['tomas', 'And why do karts reach a top speed?']],
  steps: [
    { type: 'exp', id: 'motion', goal: 'track', text: 'Program a kart run on the **Motion Track** and read its graphs.' },
    { type: 'exp', id: 'forces', goal: 'motion', text: 'Investigate F = ma and air resistance in **Force Lab → Motion**.' },
    { type: 'quiz', subs: ['P1.2', 'P1.5.1'], n: 4, text: 'Answer **4 questions** on motion and forces.' },
    choice('tomas', 'Explain top speed to **Coach Tomás**.', [['tomas', 'Why does a kart stop accelerating at top speed?']], [
      ok('Air resistance and friction grow with speed until they balance the driving force — zero resultant force means constant speed.', 'Newton’s first law in action.'),
      no('The engine runs out of energy.', 'The engine still pushes; the forces are balanced.'),
      no('Karts have a speed limiter only.', 'Balanced forces give terminal speed even without a limiter.')]),
  ],
  outro: [['tomas', 'Graphs on the wall, karts on the track. Let’s race!']] },

// ======================= HARVEST FIELDS =======================
{ id: 'q_crops', title: 'Hungry Crops', zone: 'farm', giver: 'ravi', requires: ['q_first_day'], objectives: ['B6.1', 'B6.2'], xp: 240, flag: 'crops_fixed',
  summary: 'Ravi’s greenhouse tomatoes are pale and slow. He needs a bumper crop for the festival salad stall.',
  intro: [['ravi', 'Ravi Sharma — farmer. My greenhouse tomatoes are pale and slow, and the festival wants a tonne of salad!'], ['ravi', 'Light, CO₂, warmth, fertiliser… which one is holding them back?']],
  steps: [
    { type: 'scan', poi: 'frm_greenhouse', text: 'Scan **the greenhouse**.' },
    { type: 'exp', id: 'photosynthesis', text: 'Find the limiting factors in the **Pondweed Lab**.' },
    { type: 'holo', id: 'h_leaf', text: 'Explore the **Leaf Cross-Section** holo-model.' },
    { type: 'chain', chain: C('Why the greenhouse works', 'Order how the greenhouse boosts Ravi’s tomatoes.', [
      ['Visible light passes through the glass', 'P3.3'], ['The warm soil re-emits infrared, which the glass partly traps', 'P2.3.3'],
      ['Warmer air speeds up the enzymes of photosynthesis', 'B5.1'], ['A paraffin heater adds CO₂, so it is no longer limiting', 'B6.1'],
      ['More glucose is made and moved to the fruit as sucrose', 'B8.4']], ['B6.1~P3.3', 'P2.3.3~P3.3'], 'Light, warmth and CO₂ — all three limiting factors managed.'), text: 'Solve **Why the greenhouse works**.' },
    choice('ravi', 'Advise **Ravi**.', [['ravi', 'Lights are on all day already. What should I add?']], [
      ok('Extra CO₂ and some warmth — with light already high, CO₂ concentration is now the limiting factor.', 'Add magnesium too, if leaves are yellowing.'),
      no('Even more light.', 'Once light is not limiting, more light does nothing.'),
      no('Less water so roots work harder.', 'Water is a raw material for photosynthesis.')]),
  ],
  outro: [['ravi', 'Look at them — green, tall and heavy with fruit!']] },

{ id: 'q_wilting', title: 'Wilting Wednesday', zone: 'farm', giver: 'ravi', requires: ['q_first_day'], objectives: ['B8.1', 'B8.2', 'B8.3', 'B8.4', 'B3.2'], xp: 260, flag: 'wilting_fixed',
  summary: 'A hot, windy day left Ravi’s lettuces limp, and someone salted the soil by mistake.',
  intro: [['ravi', 'Hot dry wind all morning, and now my lettuces have collapsed. And a careless helper spilled salt on one bed!'], ['ravi', 'How does water move through a plant, and why would salt hurt?']],
  steps: [
    { type: 'scan', poi: 'frm_lettuce', text: 'Scan **the wilting lettuce bed**.' },
    { type: 'exp', id: 'transpiration', text: 'Measure water loss with the **Potometer**.' },
    { type: 'exp', id: 'osmosis', text: 'Test potato tissue in salt and sugar solutions in the **Osmosis Lab**.' },
    { type: 'holo', id: 'h_plant', text: 'Trace water and sugar in the **Plant Transport** holo-model.' },
    { type: 'chain', chain: C('Why the lettuce wilted', 'Order what happened to the lettuces.', [
      ['Hot, dry wind blows across the field', 'P2.2.2'], ['Water evaporates from mesophyll cells and diffuses out of the stomata faster', 'B8.3'],
      ['The roots cannot absorb water fast enough to replace it', 'B8.2'], ['Leaf cells lose water by osmosis and become flaccid', 'B3.2'],
      ['Without turgor pressure the leaves droop — wilting', 'B8.3']], ['B8.3~P2.2.2', 'B8.2~B3.2', 'B8.3~B3.1'], 'Evaporation, diffusion and osmosis in one lettuce.'), text: 'Solve **Why the lettuce wilted**.' },
    choice('ravi', 'Explain the salty bed to **Ravi**.', [['ravi', 'Why did the salted lettuces die even though I watered them?']], [
      ok('The salty soil water has a lower water potential than the root cells, so water left the roots by osmosis.', 'Wash the salt out with lots of fresh water.'),
      no('Salt is poisonous to all leaves.', 'The main problem is osmosis at the roots.'),
      no('Salt blocks the phloem.', 'Phloem carries sugar; the problem is water uptake.')]),
  ],
  outro: [['ravi', 'Shade netting, morning watering and no more salt. They’re perking up!']] },

{ id: 'q_cells', title: 'Why Are Cells So Small?', zone: 'farm', giver: 'hana', requires: ['q_first_day'], objectives: ['B3.1', 'B3.3'], xp: 180,
  summary: 'Hana wonders why no animal has cells the size of oranges. The answer is diffusion — and surface area.',
  intro: [['hana', 'Hana Sato — botanist and beekeeper. Here’s a puzzle: why are cells so tiny? Why not one giant cell the size of an orange?']],
  steps: [
    { type: 'exp', id: 'diffusion', text: 'Time diffusion into agar cubes in the **Diffusion Lab**.' },
    { type: 'quiz', subs: ['B3.1', 'B3.3'], n: 3, text: 'Answer **3 questions** on diffusion and active transport.' },
    choice('hana', 'Answer **Hana’s** puzzle.', [['hana', 'So, why are cells small?']], [
      ok('Small cells have a large surface area to volume ratio, so substances can diffuse in and out fast enough.', 'Big cells could not supply their centres.'),
      no('Small cells are stronger.', 'It is about diffusion distance and surface area.'),
      no('Cells run out of DNA.', 'The limit is the rate of exchange.')]),
  ],
  outro: [['hana', 'Surface area — of course! Like how a bee’s hairy body collects more pollen.']] },

{ id: 'q_bees', title: 'Bee Kind', zone: 'farm', giver: 'hana', requires: ['q_first_day'], objectives: ['B15.1', 'B15.2', 'B15.3'], xp: 220,
  summary: 'Hana’s wildflower meadow and Ravi’s strawberries need pollinators. How do plants reproduce?',
  intro: [['hana', 'My bees pollinate the whole farm. For the festival I’m running a “Bee Kind” stall about how plants reproduce.'], ['hana', 'Flowers, seeds, runners… help me get the science right.']],
  steps: [
    { type: 'scan', poi: 'frm_hives', text: 'Scan **the beehives and wildflowers**.' },
    { type: 'holo', id: 'h_flower', text: 'Dissect the **Flower** holo-model.' },
    { type: 'scan', poi: 'frm_strawberry', text: 'Scan **the strawberry runners**.' },
    { type: 'exp', id: 'germination', text: 'Find what seeds need in the **Germination Trials**.' },
    { type: 'quiz', subs: ['B15.1', 'B15.2', 'B15.3'], n: 4, text: 'Answer **4 questions** on plant reproduction.' },
    choice('hana', 'Explain to **Hana**.', [['hana', 'Why grow strawberries from seed at all, if runners are faster?']], [
      ok('Seeds come from sexual reproduction, so they give variation — some offspring may resist new diseases. Runners are clones.', 'Variation helps populations survive change.'),
      no('Seeds are always faster.', 'Runners are faster; seeds give variation.'),
      no('Runners need bees.', 'Runners are asexual — no pollination needed.')]),
  ],
  outro: [['hana', 'Bee Kind is going to be the best stall at the festival!']] },

{ id: 'q_pumpkin', title: 'The Prize Pumpkin', zone: 'farm', giver: 'ravi', requires: ['q_first_day'], objectives: ['B16.1', 'B16.2', 'B16.3', 'B17.1', 'B17.2'], xp: 280,
  summary: 'Ravi wants to breed a giant orange pumpkin for the festival contest — but a white one keeps appearing.',
  intro: [['ravi', 'The festival pumpkin contest! I crossed my two best orange pumpkins and one in four seeds grew WHITE pumpkins. How?'], ['ravi', 'And how do I breed bigger ones for next year?']],
  steps: [
    { type: 'scan', poi: 'frm_pumpkins', text: 'Scan **the pumpkin patch**.' },
    { type: 'holo', id: 'h_dna', text: 'Explore **DNA & Cell Division**.' },
    { type: 'exp', id: 'genetics', goal: 'cross', text: 'Predict and test crosses in the **Breeding Lab**.' },
    { type: 'quiz', subs: ['B16.1', 'B16.2', 'B16.3', 'B17.1'], n: 4, text: 'Answer **4 questions** on inheritance and variation.' },
    choice('ravi', 'Explain the white pumpkins to **Ravi**.', [['ravi', 'Where did the white pumpkins come from?']], [
      ok('Both parents were heterozygous (Oo). One in four offspring inherited two recessive alleles (oo) — white. A 3 : 1 ratio.', 'Classic monohybrid inheritance.'),
      no('The bees brought white pollen from elsewhere.', 'The 3 : 1 ratio points to recessive alleles in both parents.'),
      no('The soil turned them white.', 'Skin colour here is genetic — discontinuous variation.')]),
  ],
  outro: [['ravi', 'Select the biggest Oo… no, OO… pumpkins every year. Selective breeding, here I come!']] },

// ======================= WHISPERING WOODS =======================
{ id: 'q_foodweb', title: 'Who Eats Whom?', zone: 'woods', giver: 'tala', requires: ['q_first_day'], objectives: ['B18.1', 'B18.2'], xp: 220,
  summary: 'Ranger Tala is mapping the island’s food webs before deciding whether to allow festival fishing.',
  intro: [['tala', 'Ranger Tala. The festival committee wants a fishing contest in the pond. Before I say yes, I need to know who eats whom.']],
  steps: [
    { type: 'scan', poi: 'wds_pond', text: 'Scan **the woodland pond**.' },
    { type: 'scan', poi: 'wds_fungi', text: 'Scan **the fungi on the fallen log**.' },
    { type: 'exp', id: 'ecosystem', text: 'Build and test the food web in the **Ecosystem Lab**.' },
    { type: 'quiz', subs: ['B18.1', 'B18.2'], n: 4, text: 'Answer **4 questions** on food chains and energy flow.' },
    choice('tala', 'Advise **Ranger Tala**.', [['tala', 'Should we allow a big fishing contest?']], [
      ok('Only a small catch-and-release one — removing many fish would let water fleas boom and starve the kingfisher.', 'Overharvesting ripples through the web.'),
      no('Yes, catch as many as possible.', 'Overharvesting affects every species linked to the fish.'),
      no('Fishing never affects other species.', 'Everything in a food web is connected.')]),
  ],
  outro: [['tala', 'Catch-and-release it is. The kingfisher thanks you.']] },

{ id: 'q_forest', title: 'The Vanishing Forest', zone: 'woods', giver: 'tala', requires: ['q_foodweb'], objectives: ['B19.1', 'B19.2', 'B18.3'], xp: 240, flag: 'forest_fixed',
  summary: 'A hillside was clear-felled for festival stages. Tala wants to understand the damage and plan a recovery.',
  intro: [['tala', 'Someone cut down a whole hillside of trees for festival timber. Now the stream floods and the soil is washing away.']],
  steps: [
    { type: 'scan', poi: 'wds_stumps', text: 'Scan **the cleared hillside**.' },
    { type: 'holo', id: 'h_carbon', text: 'Explore the **Carbon Cycle** holo-model.' },
    { type: 'chain', chain: C('Clear-felling consequences', 'Order the knock-on effects of clearing the hillside.', [
      ['Trees are felled for timber', 'B19.1'], ['Less photosynthesis means less CO₂ removed from the air', 'B6.1'],
      ['Burning the waste wood releases stored carbon as CO₂', 'B18.3'], ['More CO₂ strengthens the greenhouse effect', 'C10.2'],
      ['Habitats are lost and food webs collapse', 'B18.2']], ['B19.1~C10.2', 'B18.3~B6.1', 'B19.1~B18.2'], 'Habitat loss and climate change are linked.'), text: 'Solve **Clear-felling consequences**.' },
    { type: 'scan', poi: 'wds_seedbank', text: 'Scan **the seed bank box**.' },
    choice('tala', 'Plan the recovery with **Tala**.', [['tala', 'What is the best plan?']], [
      ok('Replant native trees from the seed bank, protect the area and educate visitors — conservation in action.', 'Monitoring, protection, seed banks and education.'),
      no('Leave it bare; it doesn’t matter.', 'Soil loss and flooding will get worse.'),
      no('Plant one fast-growing foreign species everywhere.', 'Introduced species can harm biodiversity.')]),
  ],
  outro: [['tala', 'Saplings in, fences up. In twenty years this will be forest again.']] },

{ id: 'q_survival', title: 'Survival of the Fittest', zone: 'woods', giver: 'tala', requires: ['q_foodweb'], objectives: ['B17.1', 'B17.2', 'B14.1'], xp: 220,
  summary: 'Tala’s moth survey shows dark moths increasing near the old refinery. Is it natural selection?',
  intro: [['tala', 'My moth trap shows something odd: near the sooty refinery, dark moths are winning. Here in the clean woods, pale ones are.']],
  steps: [
    { type: 'scan', poi: 'wds_moths', text: 'Scan **the moth trap**.' },
    { type: 'exp', id: 'genetics', goal: 'selection', text: 'Simulate predators in **Breeding Lab → Selection**.' },
    { type: 'chain', chain: C('Pale moths, dark bark', 'Order how the moth population changes near the refinery.', [
      ['Moth wing colour varies because of different alleles', 'B17.1'], ['Soot darkens the birch bark near the refinery', 'B19.1'],
      ['Birds spot and eat more pale moths on dark bark', 'B18.2'], ['Dark moths survive and reproduce more', 'B17.2'],
      ['The allele for dark wings becomes more common', 'B16.3']], ['B17.1~B16.3', 'B16.3~B17.2'], 'Natural selection, happening right here.'), text: 'Solve **Pale moths, dark bark**.' },
    choice('tala', 'Explain to **Tala**.', [['tala', 'Did the moths change colour to hide?']], [
      ok('No — individuals don’t change. Dark moths were already in the population; they survived better and passed on their alleles.', 'Selection acts on existing variation.'),
      no('Yes, they turned dark to camouflage themselves.', 'Individuals cannot choose their alleles.'),
      no('The soot dyed them.', 'Wing colour is inherited.')]),
  ],
  outro: [['tala', 'Now that Priya has cleaned up the refinery, I bet the pale moths come back.']] },

// ======================= ECO WORKS =======================
{ id: 'q_crude', title: 'From Crude to Useful', zone: 'eco', giver: 'priya', requires: ['q_first_day'], objectives: ['C11.3', 'C11.4', 'C11.5'], xp: 240,
  summary: 'Dr. Priya is turning the old refinery into a museum. She needs a guide to explain how crude oil is separated and cracked.',
  intro: [['priya', 'Dr. Priya Nair. We are turning this old refinery into a museum for the festival. Visitors will ask: how did one black sludge become petrol, plastic and tarmac?']],
  steps: [
    { type: 'scan', poi: 'eco_column', text: 'Scan **the fractionating column**.' },
    { type: 'exp', id: 'refinery', goal: 'distil', text: 'Separate crude oil in **Refinery → Fractional distillation**.' },
    { type: 'scan', poi: 'eco_cracker', text: 'Scan **the cracking unit**.' },
    { type: 'exp', id: 'refinery', goal: 'crack', text: 'Crack a long alkane in **Refinery → Cracking**.' },
    { type: 'quiz', subs: ['C11.3', 'C11.4', 'C11.5'], n: 4, text: 'Answer **4 questions** on fuels and hydrocarbons.' },
    choice('priya', 'Write the museum sign with **Priya**.', [['priya', 'Why does the refinery crack heavy fractions?']], [
      ok('There is more demand for petrol and alkenes than for heavy fractions, so long chains are cracked into shorter, more useful molecules.', 'Supply meets demand.'),
      no('Cracking makes crude oil.', 'Cracking breaks long hydrocarbons that were already separated.'),
      no('To make the oil heavier.', 'It makes smaller molecules.')]),
  ],
  outro: [['priya', 'The museum sign is perfect. Bitumen to refinery gas, all explained.']] },

{ id: 'q_plastic', title: 'The Plastic Tide', zone: 'eco', giver: 'priya', requires: ['q_crude'], objectives: ['C11.1', 'C11.2', 'C11.6', 'C11.7'], xp: 220,
  summary: 'Plastic washed up on the beach before the festival. Priya wants to know what plastics are — and what could replace them.',
  intro: [['priya', 'Every tide brings plastic onto our beaches. To fix it, people need to understand what plastic actually is.']],
  steps: [
    { type: 'scan', poi: 'eco_plastic', text: 'Scan **the plastic bales**.' },
    { type: 'exp', id: 'organic', text: 'Build molecules and polymers in the **Molecule Builder**.' },
    { type: 'quiz', subs: ['C11.1', 'C11.2', 'C11.6', 'C11.7'], n: 4, text: 'Answer **4 questions** on organic chemistry.' },
    choice('priya', 'Answer **Priya**.', [['priya', 'Why does poly(ethene) last for centuries on the beach?']], [
      ok('Its long chains of strong C–C and C–H covalent bonds are very unreactive, so microbes and weather break it down extremely slowly.', 'Non-biodegradable — so recycle it.'),
      no('Because it is made of ions.', 'It is covalent.'),
      no('Because it contains water.', 'It is a hydrocarbon polymer.')]),
  ],
  outro: [['priya', 'Recycling bins on every festival stall. The beach will thank you.']] },

{ id: 'q_air', title: 'Something in the Air', zone: 'eco', giver: 'priya', requires: ['q_first_day'], objectives: ['C10.2', 'C7.2', 'P2.3.3', 'B18.3'], xp: 280, flag: 'air_fixed',
  summary: 'Smog from the old flare stack hangs over the island, and the coral reef is bleaching. Priya wants answers.',
  intro: [['priya', 'The old flare stack still burns off waste gas, and on still days there is smog. Meanwhile the reef is bleaching white.'], ['priya', 'Help me understand air pollution and climate.']],
  steps: [
    { type: 'scan', poi: 'eco_air', text: 'Scan **the air-quality station**.' },
    { type: 'scan', poi: 'eco_car', text: 'Scan **the car exhaust**.' },
    { type: 'exp', id: 'climate', text: 'Run the **Atmosphere Simulator**.' },
    { type: 'chain', chain: C('Why the reef is bleaching', 'Order the chain from engines to bleached coral.', [
      ['Fossil fuels are burned in engines and power stations', 'C11.3'], ['Combustion releases CO₂ faster than the carbon cycle removes it', 'B18.3'],
      ['CO₂ absorbs and re-emits the infrared radiation emitted by the Earth', 'P2.3.3'], ['Less heat escapes to space, so the oceans warm', 'C10.2'],
      ['Warm, more acidic seas stress the corals, which bleach', 'B19.1']], ['C10.2~P2.3.3', 'B18.3~C11.3', 'B19.1~C10.2'], 'Chemistry, physics and biology in one climate story.'), text: 'Solve **Why the reef is bleaching**.' },
    choice('priya', 'Advise **Priya**.', [['priya', 'What should we do first?']], [
      ok('Shut the flare, switch to renewables and hydrogen buses, fit catalytic converters and plant trees.', 'Cut emissions at the source.'),
      no('Build taller chimneys.', 'That moves pollution elsewhere.'),
      no('Burn more fuel to warm the reef faster.', 'Warming causes bleaching.')]),
  ],
  outro: [['priya', 'The flare is out and the air is clearing. Thank you.']] },

{ id: 'q_magnet', title: 'Magnetic Sorting', zone: 'eco', giver: 'leo', requires: ['q_first_day'], objectives: ['P4.1', 'P4.5.3'], xp: 180,
  summary: 'Leo is sorting cans at the recycling yard. Why does the big magnet only pick up some of them?',
  intro: [['leo', 'Hi! I’m Leo. The big magnet picks up some cans but not others. And it drops them when Priya presses the button. Magic?']],
  steps: [
    { type: 'scan', poi: 'eco_magnet', text: 'Scan **the scrapyard electromagnet**.' },
    { type: 'exp', id: 'electromag', goal: 'electromagnet', text: 'Build an **electromagnet** in the Electromagnetism Lab.' },
    { type: 'quiz', subs: ['P4.1', 'P4.5.3'], n: 3, text: 'Answer **3 questions** on magnetism.' },
    choice('leo', 'Explain it to **Leo**.', [['leo', 'So it’s not magic?']], [
      ok('It’s an electromagnet: current in the coil makes a magnetic field, so it lifts steel cans. Switch off and it lets go. Aluminium isn’t magnetic.', 'Steel goes one way, aluminium the other.'),
      no('Aluminium cans are too heavy.', 'Aluminium is light — it just isn’t magnetic.'),
      no('The magnet is permanent.', 'Permanent magnets cannot be switched off.')]),
  ],
  outro: [['leo', 'Electromagnets are the coolest. I’m going to be a scientist too!']] },
];

export const QUEST = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
