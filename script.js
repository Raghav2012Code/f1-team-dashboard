const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// The race runs from the grid: lap 0 through to the circuit's final lap.
let lap = 0;
let maraAge = 0;
let eliAge = 0;
let totalLaps = 44;
let lapSeconds = 107.228;
let pitWindowStart = 22;
let pitWindowEnd = 24;
let activeCircuit = null;
let toastTimer;
let selectedDriver = 'mara';
let chartMode = 'pace';
let pitPlanActive = true;
let stopCompleted = false;
const SPA_LAP_SECONDS = 107.228;
const TEAM_PACE_GAP = 0.363;
const START_LAP = 0;
const TRACK_GAP_PER_POSITION = 0.05;
// Each driver runs a one-stop plan: an opening compound, then a second.
const TYRE_PLANS = {
  mara: { first: 'medium', second: 'hard', labels: { medium: 'MEDIUM', hard: 'HARD' } },
  eli: { first: 'soft', second: 'medium', labels: { soft: 'SOFT', medium: 'MEDIUM' } },
};
// A real lap is far too slow to watch, so car motion runs at 3x real time.
const LAP_TIME_SCALE = 3;
const SPA_MOTION_PATH = $('#circuitMotionPath').getAttribute('d');
let currentRoute = { width: 550, height: 443.7, d: SPA_MOTION_PATH };
let elapsedSeconds = 0;
let lastFrameTime = 0;
let lastDisplayedSecond = -1;
let raceFinished = false;

const fieldCars = [
  { position: 1, name: 'Jules Mercer', number: 1, paceOffset: -0.088 },
  { position: 2, name: 'Alba Rossi', number: 18, paceOffset: -0.038 },
  { position: 3, name: 'Luca Moreau', number: 4, paceOffset: -0.028 },
  { position: 4, name: 'Mara Voss', number: 27, paceOffset: 0, driverKey: 'mara' },
  { position: 5, name: 'Theo Park', number: 81, paceOffset: 0.022 },
  { position: 6, name: 'Felix Ward', number: 44, paceOffset: 0.052 },
  { position: 7, name: 'Eli Navarro', number: 63, paceOffset: 0.363, driverKey: 'eli' },
  { position: 8, name: 'Niko Vale', number: 14, paceOffset: 0.082 },
  { position: 9, name: 'Samir Khan', number: 22, paceOffset: -0.048 },
  { position: 10, name: 'Iris Novak', number: 2, paceOffset: 0.042 },
  { position: 11, name: 'Tom Bell', number: 77, paceOffset: -0.008 },
  { position: 12, name: 'Mateo Cruz', number: 11, paceOffset: 0.112 },
  { position: 13, name: 'Leo Hart', number: 55, paceOffset: 0.072 },
  { position: 14, name: 'Finn Okada', number: 30, paceOffset: 0.172 },
  { position: 15, name: 'Noah Price', number: 20, paceOffset: 0.122 },
  { position: 16, name: 'Hugo Silva', number: 23, paceOffset: 0.212 },
  { position: 17, name: 'Aria Laurent', number: 10, paceOffset: 0.252 },
  { position: 18, name: 'Benji Stone', number: 31, paceOffset: 0.292 },
  { position: 19, name: 'Milo Chen', number: 6, paceOffset: 0.322 },
  { position: 20, name: 'Kai Morgan', number: 99, paceOffset: 0.382 },
];

// Every car is defined by its gap to the reference lap, so the whole field
// re-times itself the moment a circuit with a different lap pace is loaded.
fieldCars.forEach((driver) => { driver.lapSeconds = SPA_LAP_SECONDS + driver.paceOffset; });

const turnNotes = {
  1: ['La Source', 'Brake late, rotate once, and please do not introduce yourself to the gravel.'],
  2: ['Eau Rouge', 'Commitment corner. The car is confident; the engineer is pretending.'],
  3: ['Raidillon', 'Keep the throttle pinned over the crest. Scenic views are for the cooldown lap.'],
  4: ['Raidillon exit', 'Unwind the steering onto Kemmel. The straight is long enough to reconsider everything.'],
  5: ['Les Combes', 'Heavy braking after the Kemmel tow. A good place to make a very polite pass.'],
  6: ['Malmedy', 'Settle the car after Les Combes. The front tyres have already read the schedule.'],
  7: ['Rivage', 'Downhill and off-camber. Be kind to the fronts; they have a long afternoon.'],
  8: ['Bruxelles', 'Long downhill left. Front-left tyre would like a word about this.'],
  9: ['No Name', 'A quick change of direction. The corner naming committee ran out of coffee.'],
  10: ['Pouhon', 'Two-apex commitment. Lift only if the laws of physics send a formal letter.'],
  11: ['Pouhon', 'Keep the second apex tidy. The front-left has submitted another complaint.'],
  12: ['Fagnes', 'Quick left-right. Make the kerbs work for you, not the suspension bill.'],
  13: ['Campus', 'A brief breath before the final run. Brief is doing a lot of work there.'],
  14: ['Stavelot', 'Get the exit right and the next straight does the rest of the negotiating.'],
  15: ['Paul Frère', 'Carry the speed through the bend. The timing screen will notice.'],
  16: ['Curve 16', 'Smooth hands on the way toward Blanchimont. The car appreciates manners.'],
  17: ['Blanchimont', 'Flat in the dry. In the wet, suddenly everyone remembers their family.'],
  18: ['Bus Stop entry', 'Brake hard and place the car. This is not the moment for artistic kerb use.'],
  19: ['Bus Stop', 'Last chance to out-brake someone before the line. Or out-brake yourself.'],
};

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2300);
}

function addFieldDots() {
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const markerLayer = $('#fieldDots');
  fieldCars.forEach((driver) => {
    const marker = document.createElementNS(svgNamespace, 'g');
    marker.classList.add('field-dot');
    if (driver.driverKey) marker.classList.add('team-car-dot', `team-${driver.driverKey}`);
    if (driver.driverKey) marker.dataset.driver = driver.driverKey;
    marker.setAttribute('role', 'img');
    marker.setAttribute('aria-label', `P${driver.position} ${driver.name}, car ${driver.number}`);

    const title = document.createElementNS(svgNamespace, 'title');
    title.textContent = `P${driver.position} · ${driver.name} #${driver.number}`;
    marker.append(title);
    if (driver.driverKey) {
      const halo = document.createElementNS(svgNamespace, 'circle');
      halo.classList.add('dot-halo');
      halo.setAttribute('r', '11');
      marker.append(halo);
    }
    const dot = document.createElementNS(svgNamespace, 'circle');
    dot.classList.add('dot-core');
    dot.setAttribute('r', driver.driverKey ? '7' : '5');
    marker.append(dot);
    if (driver.driverKey) {
      const number = document.createElementNS(svgNamespace, 'text');
      number.classList.add('dot-number');
      number.setAttribute('text-anchor', 'middle');
      number.setAttribute('y', '2.2');
      number.textContent = driver.number;
      marker.append(number);
    }
    driver.marker = marker;
    markerLayer.append(marker);
    placeDriver(driver);
  });
}

// Car motion is SVG SMIL, not CSS, so a prefers-reduced-motion rule cannot
// reach it, and freezing it via repeatCount="1" does not work either: the
// negative begin offset leaves the animation mid-iteration and it keeps
// playing. So when the setting matches, no animation element is created at
// all. Each car is placed once on the racing line and stays there. Watched
// live, so toggling the OS setting takes effect without a reload.
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = reducedMotionQuery.matches;
document.body.classList.toggle('reduced-motion', reducedMotion);

function carPhase(driver) {
  return ((0.37 - (driver.position - 4) * TRACK_GAP_PER_POSITION) % 1 + 1) % 1;
}

function createCarMotion(driver, svgNamespace = 'http://www.w3.org/2000/svg') {
  const motion = document.createElementNS(svgNamespace, 'animateMotion');
  const motionPathReference = document.createElementNS(svgNamespace, 'mpath');
  const lapDuration = driver.lapSeconds / LAP_TIME_SCALE;
  motion.setAttribute('dur', `${lapDuration}s`);
  motion.setAttribute('begin', `-${(carPhase(driver) * lapDuration).toFixed(2)}s`);
  motion.setAttribute('repeatCount', 'indefinite');
  motion.setAttribute('rotate', 'auto');
  motionPathReference.setAttribute('href', '#circuitMotionPath');
  motionPathReference.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#circuitMotionPath');
  motion.append(motionPathReference);
  return motion;
}

// Attach motion, or pin the car at its phase point on the current route.
function placeDriver(driver) {
  const path = $('#circuitMotionPath');
  const existing = driver.marker.querySelector('animateMotion');
  if (reducedMotion) {
    if (existing) driver.marker.removeChild(existing);
    driver.marker.removeAttribute('transform');
    if (path && typeof path.getPointAtLength === 'function' && path.getTotalLength() > 0) {
      const point = path.getPointAtLength(carPhase(driver) * path.getTotalLength());
      driver.marker.setAttribute('transform', `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);
    }
    return;
  }
  driver.marker.removeAttribute('transform');
  if (existing) driver.marker.replaceChild(createCarMotion(driver), existing);
  else driver.marker.append(createCarMotion(driver));
}

function applyReducedMotionPreference() {
  const wasReduced = reducedMotion;
  reducedMotion = reducedMotionQuery.matches;
  document.body.classList.toggle('reduced-motion', reducedMotion);
  if (reducedMotion === wasReduced) return;
  applyCircuitMotion(currentRoute);
  showToast(reducedMotion
    ? 'Reduced motion on. The field is parked.'
    : 'Motion restored. Back on the limit.');
}

if (typeof reducedMotionQuery.addEventListener === 'function') {
  reducedMotionQuery.addEventListener('change', applyReducedMotionPreference);
} else if (typeof reducedMotionQuery.addListener === 'function') {
  // Safari before 14 only has the deprecated API.
  reducedMotionQuery.addListener(applyReducedMotionPreference);
}

// Sector times are quoted against the base lap of the loaded circuit. Spa's
// published splits (32.441 / 41.208 / 33.579) become the reference for every
// other track by scaling with the circuit's own base lap time.
const SPA_SECTOR_SPLITS = [32.441, 41.208, 33.579];

function sectorSplitsFor(baseLapSeconds) {
  const scale = baseLapSeconds / SPA_LAP_SECONDS;
  return SPA_SECTOR_SPLITS.map((value) => value * scale);
}

function formatLapTime(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const milliseconds = Math.round((safe - Math.floor(safe)) * 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

function applyCircuitMotion(route) {
  const trackOverlay = $('#trackOverlay');
  const motionPath = $('#circuitMotionPath');
  trackOverlay.setAttribute('viewBox', `0 0 ${route.width} ${route.height}`);
  motionPath.setAttribute('d', route.d);
  // Markers only exist after addFieldDots(); the first route applies at boot.
  if (!fieldCars[0].marker) return;
  fieldCars.forEach(placeDriver);
}

const circuitSelect = $('#circuitSelect');
// The bundled Spa SVG is the "live race" view. It mirrors the `belgium` entry
// in circuits-data.js, which is why the two agree on length, laps and lap time.
const liveSpaMap = {
  slug: 'live-spa',
  name: 'Belgium · Spa-Francorchamps',
  shortName: 'Spa-Francorchamps',
  length: '7.004 km',
  laps: 44,
  date: 'Sunday, 19 July',
  country: 'Belgium',
  lapBase: 107.228,
  sectors: ['La Source → Raidillon', 'Les Combes → Fagnes', 'Stavelot → Bus Stop'],
  corner: 'Eau Rouge',
  venue: 'Spa',
  weather: { air: 18, track: 26, rain: 30, wind: 'NW 8 km/h', asphalt: 'DRY · COOLING' },
  image: 'assets/spa-francorchamps-map.svg',
  alt: 'Spa-Francorchamps track layout with all 19 numbered turns, sectors, and DRS detection zones',
};

const raceEventNames = {
  australia: 'AUSTRALIAN GRAND PRIX', china: 'CHINESE GRAND PRIX', japan: 'JAPANESE GRAND PRIX',
  miami: 'MIAMI GRAND PRIX', canada: 'CANADIAN GRAND PRIX', monaco: 'MONACO GRAND PRIX',
  // Note the two Spanish rounds, which are easy to swap: the Spanish Grand Prix
  // is the new Madrid circuit, and the long-standing race at Montmelo is now the
  // Barcelona-Catalunya Grand Prix.
  'barcelona-catalunya': 'BARCELONA-CATALUNYA GRAND PRIX', austria: 'AUSTRIAN GRAND PRIX',
  'great-britain': 'BRITISH GRAND PRIX', belgium: 'BELGIAN GRAND PRIX', hungary: 'HUNGARIAN GRAND PRIX',
  netherlands: 'DUTCH GRAND PRIX', italy: 'ITALIAN GRAND PRIX', spain: 'SPANISH GRAND PRIX',
  azerbaijan: 'AZERBAIJAN GRAND PRIX', bahrain: 'BAHRAIN GRAND PRIX', singapore: 'SINGAPORE GRAND PRIX',
  // 2026 special case: the Bahrain GP is being run at Sepang, Malaysia, after
  // the April Sakhir round was cancelled.
  'united-states': 'UNITED STATES GRAND PRIX', mexico: 'MEXICO CITY GRAND PRIX', brazil: 'SÃO PAULO GRAND PRIX',
  'las-vegas': 'LAS VEGAS GRAND PRIX', qatar: 'QATAR GRAND PRIX',
  'united-arab-emirates': 'ABU DHABI GRAND PRIX',
  'live-spa': 'BELGIAN GRAND PRIX',
};

OFFICIAL_F1_CIRCUITS.forEach((circuit) => {
  const option = document.createElement('option');
  option.value = circuit.slug;
  option.textContent = circuit.name;
  circuitSelect.append(option);
});

function setMapCredit(label, url, detail, sourceLabel = 'Formula1.com · 2026') {
  const credit = $('#mapCredit');
  credit.replaceChildren(document.createTextNode(`${label}: `));
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = sourceLabel;
  credit.append(link, document.createTextNode(` · ${detail}`));
}

// The lap badges in race control and the sector panel are written from here.
function updateLapBadges() {
  $$('[data-lap-badge]').forEach((node) => {
    node.textContent = lap === 0 ? 'FORMATION' : `LAP ${lap}`;
  });
}

function stintBars() {
  return $$('.stint-visual');
}

// The strategy desk's stint bars: the first bar fills as the opening stint is
// used, and the second one takes over once the stop is made.
function updateStintVisuals() {
  const stints = stintBars();
  ['mara', 'eli'].forEach((key, index) => {
    const plan = TYRE_PLANS[key];
    const bars = stints[index] ? stints[index].querySelectorAll('.stint-bar') : [];
    if (bars.length < 2) return;
    const [firstBar, secondBar] = bars;
    const onSecond = pitPlanActive && stopCompleted;
    // Plan B means no stop: the opening stint simply runs to the flag, so the
    // first bar keeps growing rather than freezing at the old window.
    const firstLength = pitPlanActive
      ? (onSecond ? pitWindowStart : Math.min(lap, pitWindowStart))
      : lap;
    const secondLength = onSecond ? lap - pitWindowStart : 0;
    const firstShare = Math.max(0, (firstLength / totalLaps) * 100);
    const secondShare = Math.max(0, (secondLength / totalLaps) * 100);
    firstBar.style.width = `${firstShare}%`;
    secondBar.style.width = `${secondShare}%`;
    // Collapse a stint that has not started. A 0%-wide bar still renders its
    // 7px of horizontal padding, which reads as a stray colour block.
    firstBar.classList.toggle('is-empty', firstShare === 0);
    secondBar.classList.toggle('is-empty', secondShare === 0);
    const laps = (n) => `${n} lap${n === 1 ? '' : 's'}`;
    firstBar.querySelector('b').textContent = laps(firstLength);
    secondBar.querySelector('b').textContent = onSecond ? laps(secondLength) : 'planned';
    firstBar.classList.toggle('stint-active', !onSecond);
    secondBar.classList.toggle('stint-active', onSecond);
    // Plan B means no second compound: the opening tyre runs all the way.
    const compound = onSecond ? plan.second : plan.first;
    const chip = $(`[data-compound="${key}"]`);
    if (chip) chip.textContent = plan.labels[compound];
    // The strategy dot and the driver card chip both follow the compound, so
    // the colour still says "soft" after the stop onto mediums.
    const dot = $(`[data-compound-dot="${key}"]`);
    if (dot) dot.className = `compound ${compound}-compound`;
    const card = $(`[data-driver="${key}"] .tyre-chip`);
    if (card) {
      const code = { soft: 'SOFT', medium: 'MED', hard: 'HARD' }[compound];
      card.className = `tyre-chip ${compound}`;
      card.innerHTML = `<i></i> ${code}`;
    }
  });
}

// Everything the desk shows about *where* we are: venue, lap count, lap pace,
// sector names, weather, and the copy that used to hardcode Spa.
function applyCircuitContext(circuit) {
  activeCircuit = circuit;
  totalLaps = circuit.laps;
  lapSeconds = circuit.lapBase;
  // A one-stop race: pit around 45% of the way through, then run to the flag.
  pitWindowStart = Math.max(2, Math.round(circuit.laps * 0.45));
  pitWindowEnd = Math.min(totalLaps, pitWindowStart + 2);

  const eventName = raceEventNames[circuit.slug] || `${circuit.shortName || circuit.name} GRAND PRIX`;
  const heroCorner = circuit.corner;
  $('#eventName').textContent = eventName;
  // The host nation, not the display name's prefix: the Bahrain Grand Prix
  // races in Malaysia, and Las Vegas is in the United States.
  $('#raceVenue').textContent = circuit.country || circuit.name.split(' · ')[0];
  $('#raceDate').textContent = circuit.date;
  $('#heroDate').textContent = circuit.date;
  $('#heroCircuit').textContent = circuit.shortName || circuit.name;
  $('#heroLine').innerHTML = `One eye on ${heroCorner}.<br /><em>The other on the tyres.</em>`;
  // Title-cased for the tab. "UNITED STATES GRAND PRIX" must not become
  // "United states grand prix", so the small words stay lower and the rest
  // keeps its original casing.
  const titleWords = eventName.toLowerCase().split(' ');
  const smallWords = new Set(['grand', 'prix', 'of', 'the', 'and', 'in']);
  const documentTitle = titleWords
    .map((word, index) => {
      if (index > 0 && smallWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
  document.title = `Apex GP — ${documentTitle}`;
  const { air, track, rain, wind, asphalt } = circuit.weather;
  $('#weatherVenue').textContent = (circuit.venue || circuit.shortName || circuit.name).toUpperCase();
  const icon = rain >= 45 ? '☂' : rain >= 20 ? '☁' : '☀';
  $('#weatherIcon').textContent = icon;
  $('#weatherMiniIcon').textContent = icon;
  $('#weatherAir').textContent = `${air}°`;
  $('#weatherTrack').textContent = `${track}°`;
  $('#weatherRain').textContent = `${rain}%`;
  $('#rainChance').textContent = `${rain}%`;
  $('#rainMeterFill').style.width = `${rain}%`;
  $('#weatherWind').textContent = wind;
  $('#weatherAsphalt').textContent = asphalt;
  $('#weatherMini').textContent = `${air}°`;
  $('#weatherMiniTrack').textContent = `${track}°`;
  $('#sector1Name').textContent = circuit.sectors[0];
  $('#sector2Name').textContent = circuit.sectors[1];
  $('#sector3Name').textContent = circuit.sectors[2];
  $('#incidentCorner').textContent = circuit.corner;

  // The sector table has to stay internally consistent: the purple cell must
  // be the faster of the two rows, and the "best in sector" footer must name
  // whoever actually holds it. Spa's split gives Voss S1 and S3, Navarro S2,
  // by margins of 0.166 / 0.106 / 0.303 against the session's 0.363 pace gap.
  const splits = sectorSplitsFor(circuit.lapBase);
  const sectorWinners = ['mara', 'eli', 'mara'];
  const winnerMargins = [0.166, 0.106, 0.303];
  const sectorRows = $$('.sector-driver');
  const sectorTimes = sectorWinners.map((winner, index) => {
    const reference = splits[index] + (winner === 'mara' ? 0 : TEAM_PACE_GAP / 3);
    return winner === 'mara' ? reference - winnerMargins[index] : reference;
  });
  const applyRow = (row, isMara) => {
    if (!row) return;
    const cells = [...row.querySelectorAll('span')].filter((cell) => !cell.classList.contains('sector-driver-name'));
    cells.forEach((cell, index) => {
      const holdsPurple = (sectorWinners[index] === 'mara') === isMara;
      // The winner's own time; the loser's is the winner's plus the margin.
      const seconds = holdsPurple ? sectorTimes[index] : sectorTimes[index] + winnerMargins[index];
      cell.textContent = seconds.toFixed(3);
      cell.classList.toggle('personal-best', holdsPurple);
    });
  };
  applyRow(sectorRows[0], true);
  applyRow(sectorRows[1], false);

  const bestInSector = $$('.sector-best span');
  sectorWinners.forEach((winner, index) => {
    const cell = bestInSector[index + 1];
    if (!cell) return;
    cell.innerHTML = `${winner === 'mara' ? 'VOSS' : 'NAVARRO'} <i>−${winnerMargins[index].toFixed(3)}</i>`;
  });

  // LAST LAP is the current reference pace; BEST is a little quicker, as it
  // was on the original Spa card (1:47.228 last vs 1:46.902 best).
  const driverLaps = { mara: circuit.lapBase, eli: circuit.lapBase + TEAM_PACE_GAP };
  const bestBonus = { mara: 0.326, eli: 0.820 };
  Object.entries(driverLaps).forEach(([key, seconds]) => {
    $$(`[data-lap="${key}"]`).forEach((node) => { node.textContent = formatLapTime(seconds); });
    $$(`[data-best="${key}"]`).forEach((node) => { node.textContent = formatLapTime(seconds - bestBonus[key]); });
  });

  fieldCars.forEach((driver) => {
    driver.lapSeconds = circuit.lapBase + driver.paceOffset;
  });
  applyCircuitMotion(currentRoute);

  // Changing circuit restarts the race: the lap clock, the time cap and the
  // chequered flag all belong to the circuit you are looking at.
  elapsedSeconds = 0;
  // lastFrameTime is deliberately left alone: zeroing it would make the next
  // frame's delta enormous or negative, depending on the clock's origin.
  lastDisplayedSecond = -1;
  raceFinished = false;
  stopCompleted = false;
  lap = START_LAP;
  $('#advanceLap').disabled = false;
  $('#advanceLap').textContent = 'ADVANCE LAP ＋';
  $('.status-pill').innerHTML = '<b></b> GREEN FLAG';
  $('.status-pill').style.color = '';
  $('.status-pill b').style.background = '';
  $('#simulationLabel').textContent = circuit.slug === 'live-spa' ? '20 CARS MOVING' : '20 CARS · TRACK SYNC';
  $('#simulationState').classList.remove('sim-preview');
  // renderPitPlan() calls updateRaceReadouts(), so it has to run after the
  // reset above. Running it earlier would score the old elapsed time against
  // the new circuit's lap pace and latch stopCompleted on.
  renderPitPlan();
  updateRaceReadouts();
  // Last, so it reads the reset state rather than the previous circuit's.
  updateSectorInsight();
  drawChart(chartMode);
}

function updateSectorInsight() {
  if (!activeCircuit) return;
  const finale = activeCircuit.sectors[2].split('→').pop().trim();
  const who = 'Voss';
  $('#sectorInsight').innerHTML = lap === 0
    ? `<b>No laps run yet.</b> Sector data lands after the first flying lap at ${activeCircuit.venue}.`
    : stopCompleted
      ? `<b>${who} is quicker into ${finale}.</b> Fresh rubber, so the run to the flag should be where it is won.`
      : `<b>${who} is quicker into ${finale}.</b> The opening tyres are still fresh. Conserve them.`;
}

function showCircuitMap(slug = 'live-spa') {
  const circuit = OFFICIAL_F1_CIRCUITS.find((item) => item.slug === slug);
  const isLiveSpa = !circuit;
  const mapArt = $('#mapArt');
  const trackOverlay = $('#trackOverlay');
  const trackImage = $('#realTrackMap');
  const movingLegend = $$('.moving-legend');

  if (isLiveSpa) {
    circuitSelect.value = 'live-spa';
    mapArt.classList.remove('official-map');
    mapArt.style.removeProperty('--map-aspect');
    trackImage.src = liveSpaMap.image;
    trackImage.alt = liveSpaMap.alt;
    trackOverlay.hidden = false;
    currentRoute = { width: 550, height: 443.7, d: SPA_MOTION_PATH };
    applyCircuitContext(liveSpaMap);
    $('#circuitName').textContent = liveSpaMap.shortName;
    $('#circuitLength').textContent = liveSpaMap.length;
    $('#mapEyebrow').textContent = 'LIVE RACE MAP · SPA-FRANCORCHAMPS';
    movingLegend.forEach((item) => { item.hidden = false; });
    $('#mapFooter').hidden = false;
    $('#cornerLine').hidden = false;
    $('#turnReadout').innerHTML = '<span class="turn-readout-icon">⌖</span><span><b>Pick a corner</b><small>Tap a turn marker for the engineer\'s note.</small></span><span class="map-north">N ↑</span>';
    $('#mapReset').innerHTML = 'RESET VIEW <span>↺</span>';
    setMapCredit('Map', 'https://commons.wikimedia.org/wiki/File:2022_F1_CourseLayout_Belgium.svg', 'ごひょううべこ · CC BY-SA 4.0', '2022 F1 CourseLayout · Wikimedia Commons');
    return;
  }

  circuitSelect.value = circuit.slug;
  mapArt.classList.add('official-map');
  trackImage.src = circuit.mapUrl;
  trackImage.alt = `Official 2026 Formula 1 circuit diagram for ${circuit.name}; original turn numbers and markings retained`;
  const motionRoute = OFFICIAL_CIRCUIT_ROUTES[circuit.slug];
  if (!motionRoute) {
    showToast('No racing line found for this circuit yet.');
    return showCircuitMap();
  }
  trackOverlay.hidden = false;
  currentRoute = motionRoute;
  applyCircuitContext(circuit);
  $('#circuitName').textContent = circuit.name.split(' · ').slice(1).join(' · ');
  $('#circuitLength').textContent = circuit.length;
  $('#mapEyebrow').textContent = 'OFFICIAL F1 CIRCUIT MAP · 2026';
  movingLegend.forEach((item) => { item.hidden = false; });
  $('#mapFooter').hidden = true;
  $('#cornerLine').hidden = true;
  $('#turnReadout').innerHTML = `<span class="turn-readout-icon">⌖</span><span><b>${circuit.name} · ${circuit.laps} laps</b><small>Twenty cars follow this official layout's mapped racing line as the field runs.</small></span><a class="map-source-link" href="${circuit.eventUrl}" target="_blank" rel="noreferrer">SOURCE ↗</a>`;
  $('#mapReset').innerHTML = 'BACK TO LIVE SPA <span>↶</span>';
  setMapCredit('Official map', circuit.eventUrl, 'track diagram served by Formula1.com; markings kept as published');
}

$('#realTrackMap').addEventListener('load', (event) => {
  const image = event.currentTarget;
  if (image.naturalWidth && image.naturalHeight) {
    $('#mapArt').style.setProperty('--map-aspect', `${image.naturalWidth} / ${image.naturalHeight}`);
    if (circuitSelect.value !== 'live-spa') {
      $('#trackOverlay').setAttribute('viewBox', `0 0 ${image.naturalWidth} ${image.naturalHeight}`);
    }
  }
});

$('#realTrackMap').addEventListener('error', () => {
  if (circuitSelect.value !== 'live-spa') {
    showToast('Official map did not load. Returning to the live Spa map.');
    showCircuitMap();
  }
});

circuitSelect.addEventListener('change', () => showCircuitMap(circuitSelect.value));

function updateRaceReadouts() {
  const previousLap = lap;
  // Race distance covered, 0 at the grid and totalLaps at the flag. The
  // epsilon guards the same float drift when the animation loop accumulates.
  lap = Math.min(totalLaps, Math.floor(elapsedSeconds / lapSeconds + 1e-9));
  // The stop happens on the pit window's opening lap; tyre age resets there.
  if (pitPlanActive && !stopCompleted && lap >= pitWindowStart) {
    stopCompleted = true;
    showToast(`${pitWindowStart >= totalLaps - 2 ? 'Late' : 'Planned'} stop. Fresh rubber from here.`);
  }
  const onStintTwo = pitPlanActive && stopCompleted;
  maraAge = onStintTwo ? lap - pitWindowStart : lap;
  eliAge = onStintTwo ? lap - pitWindowStart : lap;
  $('#lapReadout').textContent = `LAP ${lap} / ${totalLaps}`;
  $('#progressFill').style.width = `${(lap / totalLaps) * 100}%`;
  updateLapBadges();
  $('#maraAge').textContent = `${maraAge} LAP${maraAge === 1 ? '' : 'S'}`;
  $('#eliAge').textContent = `${eliAge} LAP${eliAge === 1 ? '' : 'S'}`;
  // Two swappable pieces rather than an innerHTML rewrite: rebuilding the
  // note on every tick would recreate the #stopCountdown node each time.
  const lead = $('#stopLead');
  const countdown = $('#stopCountdown');
  if (lead && countdown) {
    lead.textContent = stopCompleted ? 'Boxed on lap' : 'Next stop on lap';
    countdown.textContent = String(pitWindowStart);
  }
  updateStintVisuals();
  // The cap is the full race distance, so the countdown and the lap counter
  // reach zero together on every circuit. Previously this was a fixed 40:00,
  // which expired 8 laps early at Spa and far earlier at Monaco.
  const raceSeconds = totalLaps * lapSeconds;
  const timeLeft = Math.max(0, raceSeconds - elapsedSeconds);
  lastDisplayedSecond = Math.floor(elapsedSeconds);
  const capLabel = `${Math.floor(raceSeconds / 60)}:${String(Math.floor(raceSeconds % 60)).padStart(2, '0')}`;
  const finished = lap >= totalLaps;
  // Never show more than the cap: a rounding overshoot would read 78:39 on a
  // 78:38 race.
  const safeLeft = finished ? 0 : Math.min(timeLeft, raceSeconds);
  const safeMinutes = Math.floor(safeLeft / 60);
  const safeSeconds = Math.floor(safeLeft % 60);
  $('#raceClock').textContent = finished
    ? `${capLabel} RACE COMPLETE`
    : `${String(safeMinutes).padStart(2, '0')}:${String(safeSeconds).padStart(2, '0')} TO ${capLabel} CAP`;
  if (lap > previousLap) {
    const phase = stopCompleted ? 'Second stint' : 'Opening tyres';
    showToast(`Lap ${lap} of ${totalLaps}. ${phase}.`);
  }
  // The chart window and the sector insight both depend on how far we've run.
  if (lap !== previousLap) {
    drawChart(chartMode);
    updateSectorInsight();
  }
  if (lap >= totalLaps) {
    raceFinished = true;
    $('.status-pill').innerHTML = '<b></b> CHEQUERED FLAG';
    $('.status-pill').style.color = 'var(--paper)';
    $('.status-pill b').style.background = 'var(--paper)';
    $('#advanceLap').textContent = 'RACE COMPLETE';
    $('#advanceLap').disabled = true;
    $('#simulationLabel').textContent = 'CHEQUERED FLAG';
    showToast('That is the flag. Someone tell the tyres they can stop now.');
  }
}

$('#advanceLap').addEventListener('click', () => {
  if (!raceFinished && lap < totalLaps) {
    // Snap to the exact lap boundary rather than adding lapSeconds. Repeated
    // float addition drifts: at Melbourne's 80.1s lap, 58 additions land on
    // 57.9999 and the counter never reaches the flag.
    elapsedSeconds = (lap + 1) * lapSeconds;
    updateRaceReadouts();
  }
});

function animateRace(timestamp) {
  if (!lastFrameTime) lastFrameTime = timestamp;
  // Cap the step so a backgrounded tab does not fast-forward the race, and
  // clamp at zero so a timestamp reset can never drive the lap counter
  // negative.
  const delta = Math.max(0, Math.min((timestamp - lastFrameTime) / 1000, 0.1));
  lastFrameTime = timestamp;
  if (!raceFinished) {
    elapsedSeconds = Math.max(0, elapsedSeconds + delta);
    if (Math.floor(elapsedSeconds) !== lastDisplayedSecond) updateRaceReadouts();
  }
  requestAnimationFrame(animateRace);
}

$$('.turn').forEach((turn) => {
  const activate = () => {
    $$('.turn.selected').forEach((node) => node.classList.remove('selected'));
    turn.classList.add('selected');
    const [name, note] = turnNotes[turn.dataset.turn] || [`Turn ${turn.dataset.turn}`, 'Corner note pending. The map says corner; the pit wall agrees.'];
    $('#turnReadout').innerHTML = `<span class="turn-readout-icon">⌖</span><span><b>Turn ${turn.dataset.turn} · ${name}</b><small>${note}</small></span><span class="map-north">N ↑</span>`;
  };
  turn.addEventListener('click', activate);
  turn.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
  });
});

$$('.driver-card').forEach((card) => card.addEventListener('click', () => {
  $$('.driver-card').forEach((item) => item.classList.remove('active-driver'));
  card.classList.add('active-driver');
  selectedDriver = card.dataset.driver;
  $$('.team-car-dot').forEach((marker) => { marker.style.opacity = marker.dataset.driver === selectedDriver ? '1' : '.35'; });
  showToast(`${selectedDriver === 'mara' ? 'Voss' : 'Navarro'} selected. Map marker highlighted.`);
}));

// The chart plots an abstract "cost" scale rather than real seconds, so the
// shape of the data survives a circuit change even though the absolute
// lap-time numbers in the driver cards do not.
// Chart series are generated for whichever laps have actually been run, so the
// x-axis always shows the window the race has covered so far. `a` is Voss, `b`
// is Navarro; values are an abstract cost scale, not seconds.
const CHART_WINDOW = 10;
const PACE_SHAPE = [66, 59, 62, 45, 50, 37, 43, 27, 32, 21, 34, 26];
const NARRRO_SHAPE = [78, 73, 70, 77, 57, 61, 53, 55, 37, 42, 47, 39];
const POSITION_SHAPE = [25, 25, 42, 42, 42, 42, 42, 42, 42, 42, 40, 42];
const NAVARRO_POSITION_SHAPE = [58, 58, 58, 58, 58, 58, 58, 58, 58, 58, 56, 58];

// The laps actually completed, most recent last. Empty on the grid: the chart
// must not invent points for laps that have not been run.
function chartWindow(run) {
  const end = Math.max(0, run);
  const start = Math.max(1, end - CHART_WINDOW + 1);
  return Array.from({ length: end - start + 1 }, (unused, i) => start + i);
}

function sliceShape(shape, labels) {
  return labels.map((lapNumber) => shape[(lapNumber - 1) % shape.length]);
}

function lapNoun(count) {
  return `${count} lap${count === 1 ? '' : 's'}`;
}

function chartDataFor() {
  const paceLaps = chartWindow(lap);
  const positionLaps = chartWindow(lap);
  const paceLabels = paceLaps.map(String);
  const positionLabels = positionLaps.map(String);
  const noData = paceLaps.length === 0;
  return {
    pace: {
      title: noData ? 'Lap time · no laps yet' : `Lap time · last ${lapNoun(paceLaps.length)}`,
      stat: () => (noData
        ? `<b>${formatLapTime(activeCircuit.lapBase)}</b> <i>reference pace</i>`
        : `<b>${formatLapTime(activeCircuit.lapBase)}</b> <i>−0.4s vs. field</i>`),
      labels: paceLabels,
      a: sliceShape(PACE_SHAPE, paceLaps),
      b: sliceShape(NARRRO_SHAPE, paceLaps),
    },
    position: {
      title: noData ? 'Race position · on the grid' : `Race position · last ${lapNoun(positionLaps.length)}`,
      stat: () => '<b>P4 / P7</b> <i>both holding</i>',
      labels: positionLabels,
      a: sliceShape(POSITION_SHAPE, positionLaps),
      b: sliceShape(NAVARRO_POSITION_SHAPE, positionLaps),
    },
    sector: {
      title: noData ? 'Sector pace · no laps yet' : `Sector pace · lap ${lap}`,
      stat: () => '<b>−0.575s</b> <i>team delta</i>',
      labels: ['S1', 'S2', 'S3'], a: [55, 49, 31], b: [61, 44, 60],
    },
  };
}

function drawChart(mode) {
  chartMode = mode;
  const data = chartDataFor()[mode];
  $('#chartTitle').textContent = data.title;
  $('#chartStat').innerHTML = typeof data.stat === 'function' ? data.stat() : data.stat;
  $$('.chart-tab').forEach((button) => {
    const selected = button.dataset.chart === mode;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
  });

  const width = 620, height = 145, left = 30, right = 606, top = 10;
  const gridLines = [25, 55, 85, 115].map((y) => `<line class="chart-grid" x1="${left}" y1="${y}" x2="${right}" y2="${y}"/>`).join('');

  // Before the first lap there is nothing to plot, so show the grid and a
  // line of copy rather than two invented data points.
  if (!data.a.length) {
    $('#chartArea').innerHTML = `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${data.title}">${gridLines}<text class="chart-empty" x="${(left + right) / 2}" y="70" text-anchor="middle">No laps completed</text></svg>`;
    return;
  }

  // A single point has no span to divide by, so centre it.
  const span = data.labels.length - 1;
  const x = (index) => (span <= 0 ? (left + right) / 2 : left + index * ((right - left) / span));
  const points = (values) => values.map((y, i) => `${x(i)},${top + y}`).join(' ');
  const axes = data.labels.map((label, i) => `<text class="chart-axis" text-anchor="middle" x="${x(i)}" y="138">${mode === 'pace' ? `L${label}` : label}</text>`).join('');
  const markers = (values, className) => values.map((value, i) => `<circle class="${className}" cx="${x(i)}" cy="${top + value}" r="3.5"><title>${mode === 'pace' ? `Lap ${data.labels[i]}` : data.labels[i]}</title></circle>`).join('');
  $('#chartArea').innerHTML = `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${data.title} comparison chart">${gridLines}<polyline class="chart-line-yellow" points="${points(data.a)}"/><polyline class="chart-line-red" points="${points(data.b)}"/>${markers(data.a, 'chart-point-yellow')}${markers(data.b, 'chart-point-red')}${axes}</svg>`;
}

$$('.chart-tab').forEach((button) => button.addEventListener('click', () => drawChart(button.dataset.chart)));

$('#incidentToggle').addEventListener('click', () => {
  const button = $('#incidentToggle');
  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!expanded));
  $('#incidentDetail').classList.toggle('open', !expanded);
});

function renderPitPlan() {
  const button = $('#pitPlan');
  button.textContent = pitPlanActive ? '✓' : '×';
  button.classList.toggle('unplanned', !pitPlanActive);
  $('.plan-badge').textContent = pitPlanActive ? 'PLAN A' : 'PLAN B?';
  $('#pitWindow').textContent = pitPlanActive
    ? `Box window: laps ${pitWindowStart}–${pitWindowEnd}`
    : 'Running the opening tyre to the flag';
  // Plan A and Plan B are two separate elements, toggled with `hidden`, so
  // neither can destroy the node the other depends on.
  $('.plan-a-note').hidden = !pitPlanActive;
  $('.plan-b-note').hidden = pitPlanActive;
  // Plan B means no stop: the opening stint runs to the flag, so the flag
  // clears and the window reopens.
  if (!pitPlanActive) stopCompleted = false;
  updateRaceReadouts();
}

$('#pitPlan').addEventListener('click', () => {
  pitPlanActive = !pitPlanActive;
  renderPitPlan();
  showToast(pitPlanActive ? 'Pit window restored. The pit wall breathes again.' : 'Plan changed. Someone has opened three spreadsheets.');
});

$('#mapReset').addEventListener('click', () => {
  if (circuitSelect.value !== 'live-spa') {
    showCircuitMap();
    showToast('Back to the live Spa map. The field is still moving.');
    return;
  }
  $$('.turn.selected').forEach((node) => node.classList.remove('selected'));
  $('#turnReadout').innerHTML = '<span class="turn-readout-icon">⌖</span><span><b>Pick a corner</b><small>Tap a turn marker for the engineer\'s note.</small></span><span class="map-north">N ↑</span>';
  $$('.team-car-dot').forEach((marker) => { marker.style.opacity = '1'; });
  showToast('Map reset. Spa remains stubbornly the same shape.');
});

$('#soundToggle').setAttribute('aria-label', 'Toggle focus mode');
$('#soundToggle').title = 'Toggle focus mode';
$('#soundToggle').textContent = '◎';
$('#soundToggle').addEventListener('click', (event) => {
  document.body.classList.toggle('focus-mode');
  const active = document.body.classList.contains('focus-mode');
  event.currentTarget.classList.toggle('is-on', active);
  showToast(active ? 'Focus mode on. Map and strategy have the floor.' : 'Full desk restored.');
});

$('#menuButton').addEventListener('click', (event) => {
  const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
  event.currentTarget.setAttribute('aria-expanded', String(!expanded));
  document.body.classList.toggle('nav-open', !expanded);
});

$$('.topbar a, .brand').forEach((link) => link.addEventListener('click', () => {
  document.body.classList.remove('nav-open');
  $('#menuButton').setAttribute('aria-expanded', 'false');
}));

// Boot last, so every module above has been initialised before the first
// circuit context is applied.
addFieldDots();
showCircuitMap('live-spa');
requestAnimationFrame(animateRace);
