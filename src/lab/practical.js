// Practical evidence: which syllabus objectives each experiment's hands-on procedure demonstrates.
//
// A checklist's objectives here are credited as practical work (evidence `p`) once every required
// hands-on step of that checklist is done, in any order. Steps ticked by answering the analysis questions
// (the "Answer the analysis questions" step, and steps flagged `q: true`) are never part of that:
// answers are recorded as answer evidence only, so solving a question cannot also count as practical work.
// A Supplement step that names its own objectives (`o`) is evidence for those when the learner does it.
// On the Core tier, Supplement objectives in these lists are left out: they are not part of the Core course.
//
// Keys: experiment id → tab id ('main' for an experiment without tabs) → objective ids.
// Cell Explorer is not listed: it credits each observation as it is made (see microscope.js).
export const PRACTICAL = {
  // ---------------- Biology ----------------
  diffusion: { main: ['B3.1.1', 'B3.1.4', 'B3.3.1'] }, // timed agar cubes of three sizes; membrane pumps stop without respiration
  osmosis: { main: ['B3.2.2', 'B3.2.3'] }, // potato cylinders weighed before and after sucrose solutions
  foodtests: { main: ['B4.1.3'] }, // iodine, Benedict’s, biuret and ethanol emulsion tests
  enzymes: { main: ['B5.1.2', 'B5.1.5'] }, // amylase timed at several temperatures and pH values; denaturing seen at 60 °C
  photosynthesis: { main: ['B6.1.4', 'B6.1.9', 'B6.1.10'] }, // bubble counts under controlled light/CO₂; leaf starch test; hydrogencarbonate indicator
  transpiration: { main: ['B8.3.3', 'B8.3.4'] }, // potometer in still air, wind, heat and humidity
  body: {
    exercise: ['B9.2.4', 'B11.1.2', 'B11.1.4', 'B12.1.8', 'B12.1.9'], // heart and breathing rates at rest, jogging and sprinting; limewater; oxygen debt
    reaction: ['B13.1.5', 'B13.1.6', 'B13.2.3'], // reflex arc triggered; adrenaline response
  },
  yeast: { main: ['B5.1.2', 'B12.1.5', 'B12.1.7'] }, // fermentation rate across temperatures, with controls; CO₂ tested with limewater
  genetics: {
    cross: ['B16.3.11', 'B16.3.12', 'B17.1.2', 'B17.1.3'], // crosses predicted with Punnett squares, offspring counted; pumpkins weighed
    selection: ['B17.2.1', 'B17.2.4'], // moths on sooty and clean bark; bacteria under an antibiotic
  },
  germination: { main: ['B15.3.6'] }, // fair-test tubes, each removing one condition
  ecosystem: { main: ['B18.2.2', 'B18.2.3', 'B18.2.10', 'B18.2.12', 'B18.2.13'] }, // food web and chains built; energy pyramid; overfishing simulated

  // ---------------- Chemistry ----------------
  particles: {
    states: ['C1.1.3', 'P2.2.2.1', 'P2.2.2.5'], // heating curve of ice: melting and boiling plateaus
    gas: ['C1.1.4', 'P2.1.2.3', 'P2.1.3.1'], // pressure at fixed volume and at fixed temperature; Brownian motion
    diffusion: ['C1.2.1', 'C1.2.2'], // ammonia and hydrogen chloride race; position of the white ring
  },
  atoms: { main: ['C2.2.1', 'C2.2.5', 'C2.2.6', 'C2.3.1', 'C2.3.2'] }, // atoms, an isotope, ions and a noble gas built particle by particle
  bonding: { main: ['C2.4.3', 'C2.5.1', 'C2.5.2', 'C2.6.1', 'C9.3.2'] }, // electrons transferred and shared; diamond and graphite; metal and alloy compared
  electrolysis: {
    cell: ['C4.1.2', 'C4.1.3'], // molten PbBr₂, brine and dilute acid electrolysed; products tested
    fuelcell: ['C4.2.1'], // fuel cell run; its product tested
  },
  energetics: { main: ['C5.1.1', 'C5.1.2', 'C5.1.3', 'C6.1.1'] }, // exothermic and endothermic runs; pathway diagram read; changes sorted
  rates: { main: ['C6.2.1', 'C6.2.2', 'C6.2.3'] }, // fair tests of surface area, concentration, temperature, catalyst; gas volume and mass loss
  titration: { main: ['C7.1.7', 'C12.2.1', 'C12.2.2'] }, // burette, pipette and indicator; end-points and concordant titres
  salts: {
    soluble: ['C7.3.1', 'C12.4.1'], // copper(II) sulfate made, filtered and crystallised
    hydrate: ['C7.3.2', 'C10.1.1', 'C10.1.2'], // water of crystallisation driven off, tested and checked by boiling point
    precip: ['C7.3.3', 'C12.4.1'], // precipitates made; barium sulfate filtered, washed and dried
  },
  reactivity: {
    water: ['C8.2.1', 'C9.4.2', 'C9.4.3'], // Group I metals in water; metals in acid; order deduced
    displacement: ['C9.4.3', 'C9.4.4'], // twelve metal–salt pairs; metals ranked
    halogens: ['C8.3.1', 'C8.3.2', 'C8.3.3'], // halogens inspected and added to halide solutions
  },
  rusting: { main: ['C9.5.1', 'C9.5.2', 'C9.5.3', 'C9.5.4'] }, // nails in nine conditions, including barriers and zinc coating
  analysis: {
    flame: ['C12.5.4'], // flame tests of known and unknown metal ions
    ions: ['C12.5.1', 'C12.5.2', 'C12.5.3'], // cation, anion and ammonium tests on unknowns
    gases: ['C12.5.3'], // gas tests on unknowns
  },
  chromatography: { main: ['C12.3.1', 'C12.3.2'] }, // chromatogram run and measured; forged ink matched
  refinery: {
    distil: ['C11.3.5', 'C11.3.6'], // crude oil fractionally distilled; fractions matched to uses
    crack: ['C11.5.2', 'C11.5.3'], // paraffin cracked over a catalyst; products tested with bromine water
  },
  organic: { main: ['C11.2.1', 'C11.6.1', 'C11.7.2'] }, // molecules built; ethanol combustion balanced; ethene polymerised
  climate: { main: ['C10.2.1', 'C10.2.2', 'C10.2.3', 'C10.2.4'] }, // air analysed; pollutant sources and effects; emission strategies
  water: { main: ['C10.1.2', 'C10.1.4', 'C12.4.1'] }, // treatment stages ordered; sea water distilled; purity checked by boiling point

  // ---------------- Physics ----------------
  motion: {
    track: ['P1.2.3', 'P1.2.5'], // a programmed trip with rest, acceleration, constant speed and braking, plotted live
    timing: ['P1.1.2', 'P1.1.3'], // pendulum timed as single swings and as multiples
  },
  forces: {
    springs: ['P1.5.1.1', 'P1.5.1.8', 'P1.5.1.10'], // spring loaded and unloaded past the limit of proportionality
    motion: ['P1.5.1.3', 'P1.5.1.5', 'P1.5.1.6', 'P1.5.1.7'], // trolley runs varying force and mass; friction; terminal velocity
    moments: ['P1.5.2.2', 'P1.5.2.3', 'P1.5.2.4'], // metre rule balanced; mystery rock weighed by moments
    cog: ['P1.5.3.2', 'P1.5.3.3'], // plumb lines on a lamina; vehicles tilted until they topple
  },
  density: {
    density: ['P1.1.1', 'P1.4.2', 'P1.4.3'], // regular and irregular solids and a liquid measured; float or sink tested
    pressure: ['P1.7.1'], // brick stood on each face; force doubled
  },
  energy: { main: ['P1.6.1.1', 'P1.6.1.3', 'P1.6.2.2', 'P1.6.4.1'] }, // coaster energy stores; friction and Sankey; braking work; lift power
  grid: { main: ['P1.6.3.1', 'P1.6.3.2'] }, // a day of demand met with a mix of power stations
  thermal: {
    conduction: ['P2.3.1.1'], // conductors ranked by falling waxed pins
    convection: ['P2.3.2.1', 'P2.3.2.2'], // convection current traced with a crystal
    radiation: ['P2.3.3.2', 'P2.3.3.4', 'P2.3.3.5'], // Leslie’s cube emitters; absorber plates
    expansion: ['P2.2.1.1', 'P2.2.1.2'], // bimetallic strip, thermostat, ball and ring
  },
  waves: { main: ['P3.1.2', 'P3.1.3', 'P3.1.4'] }, // ripple tank: wavelength measured, reflection, refraction
  optics: {
    reflect: ['P3.2.1.1', 'P3.2.1.3'], // angles of incidence and reflection recorded
    refract: ['P3.2.2.1', 'P3.2.2.2', 'P3.2.2.3'], // angles through a glass block measured
    lens: ['P3.2.3.1', 'P3.2.3.2', 'P3.2.3.4'], // principal focus found; images beyond 2F and between F and 2F
    prism: ['P3.2.4.1', 'P3.2.4.2'], // white light dispersed; colours ordered
  },
  sound: { main: ['P3.4.2', 'P3.4.3', 'P3.4.4', 'P3.4.5', 'P3.4.6', 'P3.4.7'] }, // oscilloscope traces; hearing limits; bell jar; echo timing
  electromag: {
    magnets: ['P4.1.1', 'P4.1.2', 'P4.1.3'], // poles attract and repel; materials sorted; soft iron and steel compared
    electromagnet: ['P4.1.4', 'P4.5.3.2'], // current, turns and core varied
    motor: ['P4.5.4.1', 'P4.5.5.1', 'P4.5.5.2'], // d.c. motor made faster and reversed
    generator: ['P4.5.1.1', 'P4.5.1.2', 'P4.5.2.1', 'P4.5.2.2'], // magnet moved in a coil; a.c. generator spun and its trace read
    transformer: ['P4.5.6.1', 'P4.5.6.2'], // step-up and step-down transformers; d.c. tried
  },
  circuits: {
    build: ['P4.2.3.2', 'P4.2.4.2', 'P4.3.2.1', 'P4.3.2.2', 'P4.3.2.4', 'P4.3.2.5'], // series and parallel measured; lamps unscrewed; resistor I–V
    static: ['P4.2.1.2', 'P4.2.1.3', 'P4.2.1.5'], // rods charged by friction; conductor and insulator compared
    home: ['P4.4.2', 'P4.4.3', 'P4.4.4'], // hazards found; fuses chosen; earth fault simulated
  },
  radioactivity: {
    penetration: ['P5.2.1.1', 'P5.2.1.3', 'P5.2.2.1'], // background counted; absorbers for α, β and γ
    halflife: ['P5.2.3.1'], // random decay watched
  },
  space: { main: ['P6.1.1'] }, // planets placed in order
};

/** The objectives a checklist's hands-on steps demonstrate: `tab` is the open tab, or null without tabs. */
export const practicalFor = (labId, tab) => PRACTICAL[labId]?.[tab || 'main'] || [];
