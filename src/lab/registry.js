// Catalogue of every virtual experiment ("exp") and 3D holo-model ("holo").
// Modules are discovered with import.meta.glob so missing files never break the build.
export const META = [
  // ---------------- Biology experiments ----------------
  { id: 'microscope', kind: 'exp', subject: 'B', icon: '🔬', title: 'Cell Explorer', blurb: 'Focus a light microscope on real specimens, identify organelles and calculate magnification.', objectives: ['B2.1', 'B2.2', 'B9.4', 'B8.2', 'B1.1'] },
  { id: 'diffusion', kind: 'exp', subject: 'B', icon: '🧊', title: 'Diffusion Lab', blurb: 'Race acid into agar cubes of different sizes and watch active transport pump ions uphill.', objectives: ['B3.1', 'B3.3'] },
  { id: 'osmosis', kind: 'exp', subject: 'B', icon: '🥔', title: 'Osmosis Lab', blurb: 'Soak potato cylinders in sugar solutions, weigh them and find the isotonic point.', objectives: ['B3.2'] },
  { id: 'foodtests', kind: 'exp', subject: 'B', icon: '🥪', title: 'Food Detective', blurb: 'Iodine, Benedict’s, biuret and ethanol tests on everyday foods.', objectives: ['B4.1', 'B7.1'] },
  { id: 'enzymes', kind: 'exp', subject: 'B', icon: '🧫', title: 'Enzyme Lab', blurb: 'Time amylase digesting starch at different temperatures and pH; see the active site in 3D.', objectives: ['B5.1', 'B7.3'] },
  { id: 'photosynthesis', kind: 'exp', subject: 'B', icon: '🌿', title: 'Pondweed Lab', blurb: 'Count oxygen bubbles as you vary light, CO₂ and temperature — find the limiting factor.', objectives: ['B6.1'] },
  { id: 'transpiration', kind: 'exp', subject: 'B', icon: '💧', title: 'Potometer', blurb: 'Measure how fast a leafy shoot loses water in wind, heat and humidity.', objectives: ['B8.3', 'B8.2', 'B8.1'] },
  { id: 'body', kind: 'exp', subject: 'B', icon: '🏃', title: 'Body Lab', blurb: 'Exercise on a treadmill to see heart rate, breathing and lactic acid — then test your reflexes.', objectives: ['B9.2', 'B11.1', 'B12.1', 'B13.1', 'B13.2'], tabs: ['exercise', 'reaction'] },
  { id: 'yeast', kind: 'exp', subject: 'B', icon: '🍞', title: 'Fermentation Station', blurb: 'Find the temperature at which yeast releases the most CO₂ — the secret of rising bread.', objectives: ['B12.1', 'B5.1', 'C11.6'] },
  { id: 'genetics', kind: 'exp', subject: 'B', icon: '🎃', title: 'Breeding Lab', blurb: 'Punnett squares, real offspring counts and a natural-selection predator simulation.', objectives: ['B16.1', 'B16.3', 'B17.1', 'B17.2', 'B15.2'], tabs: ['cross', 'selection'] },
  { id: 'germination', kind: 'exp', subject: 'B', icon: '🌱', title: 'Germination Trials', blurb: 'Which conditions do seeds really need? Set up fair tests and fast-forward a week.', objectives: ['B15.3'] },
  { id: 'ecosystem', kind: 'exp', subject: 'B', icon: '🐟', title: 'Ecosystem Lab', blurb: 'Build the pond food web, follow energy through trophic levels and test what overfishing does.', objectives: ['B18.1', 'B18.2', 'B18.3'] },
  // ---------------- Chemistry experiments ----------------
  { id: 'particles', kind: 'exp', subject: 'C', icon: '🫧', title: 'Particle Lab', blurb: 'Heating curves, gas laws and the ammonia–HCl diffusion race with live particle models.', objectives: ['C1.1', 'C1.2', 'P2.1.1', 'P2.1.2', 'P2.1.3', 'P2.2.2'], tabs: ['states', 'gas', 'diffusion'] },
  { id: 'atoms', kind: 'exp', subject: 'C', icon: '⚛️', title: 'Atom Forge', blurb: 'Build atoms proton by proton; make isotopes and ions and read nuclide notation.', objectives: ['C2.1', 'C2.2', 'C2.3', 'C8.1', 'P5.1'] },
  { id: 'bonding', kind: 'exp', subject: 'C', icon: '🔗', title: 'Bond Builder', blurb: 'Transfer and share electrons; explore NaCl, diamond, graphite and metallic lattices.', objectives: ['C2.4', 'C2.5', 'C2.6', 'C2.7', 'C3.1', 'C9.3'] },
  { id: 'electrolysis', kind: 'exp', subject: 'C', icon: '🔋', title: 'Electrolysis Cell', blurb: 'Split compounds with electricity, watch ions migrate and power a hydrogen fuel cell.', objectives: ['C4.1', 'C4.2', 'C9.6', 'C6.3'], tabs: ['cell', 'fuelcell'] },
  { id: 'energetics', kind: 'exp', subject: 'C', icon: '🔥', title: 'Hot & Cold Reactions', blurb: 'Measure temperature changes and draw reaction pathway diagrams.', objectives: ['C5.1', 'C6.1'] },
  { id: 'rates', kind: 'exp', subject: 'C', icon: '⏱️', title: 'Reaction Rates', blurb: 'Marble chips and acid: gas syringe, surface area, temperature, concentration and catalysts.', objectives: ['C6.2', 'C12.1'] },
  { id: 'titration', kind: 'exp', subject: 'C', icon: '⚗️', title: 'Titration Lab', blurb: 'Burette, pipette and indicator — neutralise acid drop by drop and calculate concentration.', objectives: ['C7.1', 'C12.2', 'C3.3', 'C12.1'] },
  { id: 'salts', kind: 'exp', subject: 'C', icon: '💎', title: 'Salt Workshop', blurb: 'Make copper(II) sulfate crystals, dehydrate them and precipitate insoluble salts.', objectives: ['C7.3', 'C7.2', 'C10.1', 'C12.4', 'C3.2'], tabs: ['soluble', 'hydrate', 'precip'] },
  { id: 'reactivity', kind: 'exp', subject: 'C', icon: '🧨', title: 'Metal Reactivity', blurb: 'Metals in water and acid, displacement reactions, Group I and the halogens.', objectives: ['C9.4', 'C9.1', 'C9.2', 'C8.2', 'C8.3', 'C6.3'], tabs: ['water', 'displacement', 'halogens'] },
  { id: 'rusting', kind: 'exp', subject: 'C', icon: '⚓', title: 'Rust Investigation', blurb: 'Seven nails, seven conditions, one week — what does iron need to rust?', objectives: ['C9.5', 'C6.3'] },
  { id: 'analysis', kind: 'exp', subject: 'C', icon: '🕵️', title: 'Chemical Detective', blurb: 'Flame tests, precipitates and gas tests to identify unknown substances.', objectives: ['C12.5', 'C8.4'], tabs: ['flame', 'ions', 'gases'] },
  { id: 'chromatography', kind: 'exp', subject: 'C', icon: '🖊️', title: 'Chromatography', blurb: 'Separate inks on paper, calculate Rf values and catch a forger.', objectives: ['C12.3', 'C12.4'] },
  { id: 'refinery', kind: 'exp', subject: 'C', icon: '🛢️', title: 'Crude Oil Refinery', blurb: 'Fractional distillation of crude oil, then crack long alkanes and test with bromine water.', objectives: ['C11.3', 'C11.4', 'C11.5'], tabs: ['distil', 'crack'] },
  { id: 'organic', kind: 'exp', subject: 'C', icon: '🧬', title: 'Molecule Builder', blurb: 'Build alkanes, alkenes and alcohols; zip ethene into poly(ethene) and make nylon.', objectives: ['C11.1', 'C11.2', 'C11.6', 'C11.7'] },
  { id: 'climate', kind: 'exp', subject: 'C', icon: '🌍', title: 'Atmosphere Simulator', blurb: 'Adjust emissions and watch air quality, acid rain and the greenhouse effect respond.', objectives: ['C10.2', 'C7.2', 'P2.3.3'] },
  { id: 'water', kind: 'exp', subject: 'C', icon: '🚰', title: 'Water Treatment', blurb: 'Run a treatment plant from sea water to tap, and test purity by boiling point.', objectives: ['C10.1', 'C12.4', 'B10.1'] },
  // ---------------- Physics experiments ----------------
  { id: 'motion', kind: 'exp', subject: 'P', icon: '🏎️', title: 'Motion Lab', blurb: 'Program a go-kart and read its distance–time and speed–time graphs; time a pendulum.', objectives: ['P1.1', 'P1.2'], tabs: ['track', 'timing'] },
  { id: 'forces', kind: 'exp', subject: 'P', icon: '🏋️', title: 'Force Lab', blurb: 'Springs and Hooke’s law, F = ma and terminal velocity, moments and stability.', objectives: ['P1.5.1', 'P1.5.2', 'P1.5.3', 'P1.3'], tabs: ['springs', 'motion', 'moments', 'cog'] },
  { id: 'density', kind: 'exp', subject: 'P', icon: '🧱', title: 'Density & Pressure', blurb: 'Measure mass and volume, predict floating and sinking, and stand blocks on sand.', objectives: ['P1.4', 'P1.7', 'P1.3', 'P1.1'], tabs: ['density', 'pressure'] },
  { id: 'energy', kind: 'exp', subject: 'P', icon: '🎢', title: 'Energy Coaster', blurb: 'Watch kinetic and potential energy trade places; measure work, power and efficiency.', objectives: ['P1.6.1', 'P1.6.2', 'P1.6.4', 'P1.6.3'] },
  { id: 'grid', kind: 'exp', subject: 'P', icon: '🏭', title: 'Island Power Grid', blurb: 'Mix power stations to meet a day of demand — renewable, reliable and clean.', objectives: ['P1.6.3', 'P4.5.6', 'C10.2', 'C4.2'] },
  { id: 'thermal', kind: 'exp', subject: 'P', icon: '🌡️', title: 'Heat Transfer Lab', blurb: 'Conduction rods, convection currents, Leslie’s cube and a bimetallic strip.', objectives: ['P2.3.1', 'P2.3.2', 'P2.3.3', 'P2.3.4', 'P2.2.1'], tabs: ['conduction', 'convection', 'radiation', 'expansion'] },
  { id: 'waves', kind: 'exp', subject: 'P', icon: '🌊', title: 'Ripple Tank', blurb: 'Make waves; measure wavelength and speed; watch reflection, refraction and diffraction.', objectives: ['P3.1'] },
  { id: 'optics', kind: 'exp', subject: 'P', icon: '🔦', title: 'Light Bench', blurb: 'Ray box with mirrors, glass blocks, total internal reflection, lenses and a prism.', objectives: ['P3.2.1', 'P3.2.2', 'P3.2.3', 'P3.2.4'], tabs: ['reflect', 'refract', 'lens', 'prism'] },
  { id: 'sound', kind: 'exp', subject: 'P', icon: '🔊', title: 'Sound Studio', blurb: 'Hear and see pitch and loudness on an oscilloscope; measure the speed of sound by echo.', objectives: ['P3.4'] },
  { id: 'electromag', kind: 'exp', subject: 'P', icon: '🧲', title: 'Electromagnetism Lab', blurb: 'Field lines, electromagnets, motors, generators and transformers.', objectives: ['P4.1', 'P4.5.1', 'P4.5.2', 'P4.5.3', 'P4.5.4', 'P4.5.5', 'P4.5.6'], tabs: ['magnets', 'electromagnet', 'motor', 'generator', 'transformer'] },
  { id: 'circuits', kind: 'exp', subject: 'P', icon: '💡', title: 'Circuit Builder', blurb: 'Series and parallel circuits, meters and I–V graphs, static charge and home safety.', objectives: ['P4.2.1', 'P4.2.2', 'P4.2.3', 'P4.2.4', 'P4.2.5', 'P4.3.1', 'P4.3.2', 'P4.4'], tabs: ['build', 'static', 'home'] },
  { id: 'radioactivity', kind: 'exp', subject: 'P', icon: '☢️', title: 'Radiation Lab', blurb: 'Geiger counter, absorbers for α, β and γ, and a live half-life simulation.', objectives: ['P5.2.1', 'P5.2.2', 'P5.2.3', 'P5.2.4', 'P5.2.5', 'P5.1'], tabs: ['penetration', 'halflife'] },
  { id: 'space', kind: 'exp', subject: 'P', icon: '🪐', title: 'Orrery & Stars', blurb: 'An interactive Solar System with orbital speeds and light travel times.', objectives: ['P6.1', 'P6.2.1', 'P1.3'] },
  // ---------------- Holo-models ----------------
  { id: 'h_digestive', kind: 'holo', subject: 'B', icon: '🫃', title: 'Digestive System', blurb: 'Follow food from mouth to anus; see where each enzyme works.', objectives: ['B7.2', 'B7.3'] },
  { id: 'h_heart', kind: 'holo', subject: 'B', icon: '🫀', title: 'Heart & Circulation', blurb: 'A beating heart with valves, chambers and the double circulation.', objectives: ['B9.1', 'B9.2', 'B9.3'] },
  { id: 'h_lungs', kind: 'holo', subject: 'B', icon: '🫁', title: 'Lungs & Alveoli', blurb: 'Breathing mechanics and gas exchange at the alveoli.', objectives: ['B11.1'] },
  { id: 'h_leaf', kind: 'holo', subject: 'B', icon: '🍃', title: 'Leaf Cross-Section', blurb: 'Palisade, spongy mesophyll, stomata and veins in 3D.', objectives: ['B6.2', 'B6.1'] },
  { id: 'h_plant', kind: 'holo', subject: 'B', icon: '🌳', title: 'Plant Transport', blurb: 'Water up the xylem, sugar through the phloem, ions pumped into root hairs.', objectives: ['B8.1', 'B8.2', 'B8.4', 'B3.3'] },
  { id: 'h_flower', kind: 'holo', subject: 'B', icon: '🌸', title: 'Flower Anatomy', blurb: 'Insect- and wind-pollinated flowers, pollination and fertilisation.', objectives: ['B15.3'] },
  { id: 'h_nervous', kind: 'holo', subject: 'B', icon: '🧠', title: 'Nervous & Hormone Systems', blurb: 'A reflex arc in action, and the glands that release hormones.', objectives: ['B13.1', 'B13.2'] },
  { id: 'h_skin', kind: 'holo', subject: 'B', icon: '🌡️', title: 'Skin & Homeostasis', blurb: 'How skin keeps you at 37 °C — sweating, shivering and blood vessels.', objectives: ['B13.3'] },
  { id: 'h_immune', kind: 'holo', subject: 'B', icon: '🦠', title: 'Immune Defence', blurb: 'Pathogens, phagocytes, antibodies and memory cells.', objectives: ['B10.1', 'B9.4', 'B14.1'] },
  { id: 'h_reproduction', kind: 'holo', subject: 'B', icon: '👶', title: 'Human Reproduction', blurb: 'Reproductive systems, gametes and fertilisation.', objectives: ['B15.4', 'B15.2', 'B15.5'] },
  { id: 'h_dna', kind: 'holo', subject: 'B', icon: '🧬', title: 'DNA & Cell Division', blurb: 'From DNA to chromosomes; mitosis versus meiosis; asexual reproduction.', objectives: ['B16.1', 'B16.2', 'B15.1'] },
  { id: 'h_carbon', kind: 'holo', subject: 'B', icon: '♻️', title: 'Carbon Cycle', blurb: 'Carbon’s journey through air, plants, animals, soil and fossil fuels.', objectives: ['B18.3', 'B19.1', 'B19.2', 'C10.2'] },
  { id: 'h_blastfurnace', kind: 'holo', subject: 'C', icon: '🏭', title: 'Blast Furnace', blurb: 'The reactions that turn hematite into molten iron.', objectives: ['C9.6', 'C6.3'] },
  { id: 'h_periodic', kind: 'holo', subject: 'C', icon: '🧪', title: 'Periodic Table', blurb: 'A 3D Periodic Table: groups, periods and trends.', objectives: ['C8.1', 'C8.2', 'C8.3', 'C8.4', 'C8.5'] },
  { id: 'h_spectrum', kind: 'holo', subject: 'P', icon: '🌈', title: 'Electromagnetic Spectrum', blurb: 'Seven families of waves, their uses and their dangers.', objectives: ['P3.3', 'P3.2.4'] },
  { id: 'h_stars', kind: 'holo', subject: 'P', icon: '✨', title: 'Life of Stars', blurb: 'From nebula to white dwarf or black hole, and our place in the galaxy.', objectives: ['P6.2.2', 'P6.2.3', 'P6.2.1'] },
];

const EXP = import.meta.glob('./experiments/*.js');
const HOLO = import.meta.glob('./holos/*.js');
export function loaderFor(id) {
  const m = META.find((x) => x.id === id);
  if (!m) return null;
  const key = m.kind === 'holo' ? `./holos/${id}.js` : `./experiments/${id}.js`;
  return (m.kind === 'holo' ? HOLO : EXP)[key] || null;
}
