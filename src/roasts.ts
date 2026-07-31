// ============================================================
// WAKALEAD ROAST ENGINE
// Generates per-user status messages ("roasts") that are:
//   - AI-aware   (heavy AI users vs pure human grinders)
//   - spread-aware (tight races never bash the trailer)
//   - no-repeat  (per-user seen buffer so messages rotate)
// ============================================================

export type RoastTone = 'god' | 'praise' | 'solid' | 'neutral' | 'mild' | 'hard' | 'slacker';

export type RoastTheme = 'ai' | 'human' | 'balanced' | 'tight';

export type Metric = 'total' | 'human' | 'ai' | 'lines';

export interface BoardStats {
  min: number;
  max: number;
  mean: number;
  spreadRatio: number; // (max - min) / max, 0 when max is 0
  tightRace: boolean;  // everyone is grinding AND the field is close
}

export interface RoastContext {
  user_id: number;
  rank: number;
  totalEntries: number;
  totalSeconds: number;
  humanSeconds: number;
  aiSeconds: number;
  aiLines: number;
  humanLines: number;
  allTimeSeconds?: number;
  topLanguage?: string | null;
  topEditor?: string | null;
  topProject?: string | null;
  isAdmin?: boolean;
  metric: Metric;
  board: BoardStats;
}

export interface RoastResult {
  text: string;
  tone: RoastTone;
}

interface PoolLine {
  text: string;
  theme?: RoastTheme; // omitted => applies to every theme
}

interface TemplateLine {
  text: string; // may contain {lang} / {editor} / {project}
  theme?: RoastTheme;
}

// ------------------------------------------------------------------
// MESSAGE LIBRARY - organized by tone, tagged by theme
// ------------------------------------------------------------------

const GOD: { pool: PoolLine[]; templates: TemplateLine[] } = {
  pool: [
    { text: 'Aakha futla hai bhai 👓', theme: 'human' },
    { text: 'Dev Manush (God Mode) 🙏', theme: 'human' },
    { text: 'Touch grass please 🌱' },
    { text: 'Water piyo bro 💧' },
    { text: 'Sleep optional? 😴' },
    { text: 'Keyboard warrior 🎖️' },
    { text: 'Code machine 🤖', theme: 'ai' },
    { text: 'Bhai rest ni gara 🛌' },
    { text: 'VSCode 24/7, bed an-option 🤖', theme: 'ai' },
    { text: 'Is code... or is it your bloodstream now? 🫀' },
    { text: 'The grind is UNREAL, protect ur neck 🦴' },
    { text: 'Office chair become home 🪑' },
    { text: 'Your monitor needs a restraining order 🖥️' },
    { text: 'WCLS: World Code Labour Special? 😅', theme: 'human' },
    { text: '10+ hrs = actually an AI in disguise 🥸', theme: 'ai' },
    { text: 'Even the sun logged fewer hours ☀️' },
    { text: 'Doctor says: back problems incoming 🚨' },
    { text: 'Terminal > personal life 💀' },
    { text: 'Grind kti garchau yaar, thopa 🌊', theme: 'human' },
    { text: 'Bro is turning into a git commit 📦' },
    { text: 'Only fans: ur cooling fan 🌀' },
    { text: 'U and the CPU have the same core count now 🔥', theme: 'ai' },
    { text: 'Coffee? Nope, raw caffeine IV 💉' },
    { text: 'Ramen stock level: critical 🍜' },
    { text: 'U know chairs exist for sitting right? 🪑' },
    { text: 'Blinking is a new feature u forgot to ship 👁️' },
    { text: 'Windows sleep? Never heard of her 💤' },
    { text: 'The keyboard is begging for mercy ⌨️' },
    { text: 'Achievement unlocked: no social life 🏆' },
    { text: 'Carpal tunnel speedrun any% 🏃' },
    { text: 'Bro single-handedly keeping the GPU warm 🥵', theme: 'ai' },
    { text: 'The AI does the thinking, u do the clicking 🖱️', theme: 'ai' },
    { text: 'Token inferno, ur wallet is crying 💸', theme: 'ai' },
    { text: 'Prompt slop, but make it 10 hours 🤖', theme: 'ai' },
    { text: 'Hand typed this much? Respect + concern 🖐️', theme: 'human' },
    { text: 'Masochist of the keyboard ⌨️', theme: 'human' },
    { text: 'u couldve asked AI... but no, THE HARD WAY 😤', theme: 'human' },
    { text: 'sweat, tears, and keystrokes 🥲', theme: 'human' },
  ],
  templates: [
    { text: 'Top language {lang} and u still did {hours}+ hrs?? go sleep 😴' },
    { text: '{editor} + {hours}h today... the editor is reconsidering its life choices' },
    { text: '{hours} hrs in {lang}. Your chair filed a complaint 🪑' },
  ],
};

const PRAISE: { pool: PoolLine[]; templates: TemplateLine[] } = {
  pool: [
    { text: 'fucking crazy 🔥' },
    { text: 'absolute beast mode 🦁' },
    { text: 'kya baat hai bhai 💯' },
    { text: 'pagal hai kya? 🤯' },
    { text: 'unstoppable force 🚀' },
    { text: 'touch some grass bro 🥬' },
    { text: 'hacker hai bhai hacker 💻' },
    { text: 'top 3 baby! 🎯' },
    { text: 'podium finish 🏆' },
    { text: 'flow state achieved 🌊' },
    { text: 'zone mai cha bro 🎯' },
    { text: 'sher ho yaar 🦁', theme: 'human' },
    { text: 'natural-born coder 👑', theme: 'human' },
    { text: 'no prompt, all pride 🦾', theme: 'human' },
    { text: 'human first, machine never 🧠', theme: 'human' },
    { text: 'typing like it pays rent 💸', theme: 'human' },
    { text: 'the only slave here is ur keyboard ⌨️', theme: 'human' },
    { text: 'AI sarkar ho timi ta 🤖', theme: 'ai' },
    { text: 'prompt jockey supreme 🏇', theme: 'ai' },
    { text: 'token budget? never met her 💰', theme: 'ai' },
    { text: 'AI speedrun champion ⚡', theme: 'ai' },
    { text: 'paid for the AI, using the whole thing 🤖', theme: 'ai' },
    { text: 'money to burn, tokens to earn 🔥', theme: 'ai' },
    { text: 'this leaderboard is basically u vs electricity ⚡', theme: 'ai' },
    { text: 'living in the future, smh 🤖', theme: 'ai' },
    { text: 'everyone else is warming up, u already won 🏁' },
    { text: 'main character energy 📸' },
    { text: 'give this person a medal 🥇' },
    { text: 'exactly what the grind looks like 😮‍💨' },
    { text: 'rest of the board is looking at u like 👀' },
    { text: 'the AI sees ur vision, literal king 👑', theme: 'ai' },
    { text: 'token tycoon at work 🏦', theme: 'ai' },
    { text: 'ur prompts are poetry, the output is art 🎨', theme: 'ai' },
    { text: 'money + model = menace 🚀', theme: 'ai' },
    { text: 'manual legend, unassisted GOAT 🐐', theme: 'human' },
    { text: 'keyboard samurai, no second opinions 🗡️', theme: 'human' },
    { text: 'hand-coded everything and it SHOWS 🏆', theme: 'human' },
    { text: 'the last real programmer standing 🫡', theme: 'human' },
  ],
  templates: [
    { text: '{lang} king/queen spotted 👑', theme: 'human' },
    { text: '{lang} ho ra top time? maan gaye guru 🙏', theme: 'human' },
    { text: 'crushing it in {lang} ngl 💪' },
    { text: '{editor} warrior, carry on 🛡️', theme: 'human' },
    { text: '{project} yeh aatma lagyo, dedication 🤝' },
  ],
};

const SOLID: { pool: PoolLine[]; templates: TemplateLine[] } = {
  pool: [
    { text: 'Khatra! 🚀' },
    { text: 'Serious business 💼' },
    { text: 'Dedicated developer 💪' },
    { text: 'Solid grind bhai 💪' },
    { text: 'respectable hustle 💼' },
    { text: 'silver medal worthy 🥈' },
    { text: 'almost there bro 👀' },
    { text: 'runner-up king 👑' },
    { text: 'bronze but golden 🥉' },
    { text: 'decent numbers, respect 🫡' },
    { text: 'consistent, ki kura 🙌', theme: 'human' },
    { text: 'typing away like a pro ⌨️', theme: 'human' },
    { text: 'old-school grind, new-school speed 🐢➡️🐇', theme: 'human' },
    { text: 'no shortcuts needed 🚫', theme: 'human' },
    { text: 'hand-coded, hand-signed ✍️', theme: 'human' },
    { text: 'the slave era but make it comfortable 😤', theme: 'human' },
    { text: 'wage-slave coding, love to see it 💼', theme: 'human' },
    { text: 'AI pe kharcha utna, kaam pura 🔁', theme: 'ai' },
    { text: 'token go brrr while u sleep 💤', theme: 'ai' },
    { text: 'letting the machines earn their keep 🤖', theme: 'ai' },
    { text: 'full stack: u + ur AI assistant 🧑‍💻', theme: 'ai' },
    { text: 'prompt engineering degree loading... 🎓', theme: 'ai' },
    { text: 'ctrl+shift+enter, chef kiss 🤌', theme: 'ai' },
    { text: 'burning money AND calories 🔥', theme: 'ai' },
    { text: 'steady ship, smooth sailing ⛵' },
    { text: 'keep this pace and the board is urs 📈' },
    { text: 'workhorse detected 🐎' },
    { text: 'today you earned the coffee ☕' },
    { text: 'efficiency in motion ⚙️' },
    { text: 'built different (literally) 🧱' },
    { text: 'AI-assisted and proud, mostly 🤖', theme: 'ai' },
    { text: 'token economy thriving 📈', theme: 'ai' },
    { text: 'u n the model, tag team champions 🏆', theme: 'ai' },
    { text: 'prompt to product pipeline 🔧', theme: 'ai' },
    { text: 'hand-rolled code, like an artisanal baker 🥖', theme: 'human' },
    { text: 'no AI, just vibes and syntax errors 🎸', theme: 'human' },
    { text: 'manual mode enjoyer, respect 🫡', theme: 'human' },
    { text: 'human compiler, no autocomplete 🧠', theme: 'human' },
  ],
  templates: [
    { text: '{lang} grinders stay winning 📈', theme: 'human' },
    { text: '{lang}? solid choice, carry on 👍' },
    { text: '{project} is lucky to have u ❤️' },
  ],
};

const NEUTRAL: { pool: PoolLine[]; templates: TemplateLine[] } = {
  pool: [
    { text: 'Thikthak kaam 🔥' },
    { text: 'Sahi ho, carry on' },
    { text: 'Decent effort bro 👍' },
    { text: 'Average enjoyer 📊' },
    { text: 'Balanced lifestyle 🧘' },
    { text: 'Moderate grinder 💼' },
    { text: 'solid number 2 💪' },
    { text: 'better luck next time 🎲' },
    { text: 'practice more bro 📚' },
    { text: 'comeback season loading... 🔄' },
    { text: 'mid but make it proud 🥱' },
    { text: 'the tutorial zone 🌀' },
    { text: 'README reader champion 📖' },
    { text: 'theme customization expert 🎨' },
    { text: 'mid-tier energy, full-tier ego 😌' },
    { text: 'existed, that counts for something ✅' },
    { text: 'compromise between grind and chill ☕' },
    { text: 'progress, but where is the passion? 🤔' },
    { text: 'u coded enough to stay out of trouble ⚖️' },
    { text: 'one foot in, one foot out 🦶', theme: 'human' },
    { text: 'still hand-typing like a champ ⌨️', theme: 'human' },
    { text: 'manual labour, manual everything 🛠️', theme: 'human' },
    { text: 'the last person writing code by hand ✍️', theme: 'human' },
    { text: 'human effort: measured, respected 📏', theme: 'human' },
    { text: 'no AI, just stubbornness 🧠', theme: 'human' },
    { text: 'somewhere a robot is typing faster than u 🤖', theme: 'ai' },
    { text: 'let the AI do a little heavy lifting? 🤖', theme: 'ai' },
    { text: 'u pay for AI? this looks manual 😤', theme: 'ai' },
    { text: 'free thinking, paid tokens? nah 💸', theme: 'ai' },
    { text: 'u tokened just enough to look busy 🤏', theme: 'ai' },
    { text: 'AI half-coded this, and it shows 🫠', theme: 'ai' },
    { text: 'mid AI usage, mid everything 😐', theme: 'ai' },
    { text: 'u n the model split the work 50/50 💇', theme: 'ai' },
    { text: 'typing manually, why suffer? 🥲', theme: 'human' },
    { text: 'no AI crutches, pure willpower (and back pain) 🦴', theme: 'human' },
    { text: 'u could delegate, u chose the keyboard 🖐️', theme: 'human' },
    { text: 'slave to the craft, and I mean that kindly 😤', theme: 'human' },
    { text: 'hand-made code, artisanal 🎨', theme: 'human' },
    { text: 'the middle child of the leaderboard 😐' },
    { text: 'fine. just fine.' },
  ],
  templates: [
    { text: '{lang} hai, chalega 😅' },
    { text: '{editor} enjoyer spotted 🎯' },
  ],
};

const MILD: { pool: PoolLine[]; templates: TemplateLine[] } = {
  pool: [
    { text: 'your routine: chai piyo, biscuit khao 🍪' },
    { text: 'Tarak Mehta Kaa Ulta Chasma > Code? 📺' },
    { text: 'biscuit break extended? 🍪' },
    { text: 'nap time champion 😴' },
    { text: 'professional procrastinator 🤡' },
    { text: 'participation trophy lele 🏆' },
    { text: 'attendance award 🎖️' },
    { text: 'you showed up at least 👏' },
    { text: 'E for Effort 📝' },
    { text: 'consolation prize incoming 🎁' },
    { text: 'aagle saal fir try karna 🤡' },
    { text: 'at least you opened VSCode 😮‍💨' },
    { text: 'startup time counts right? 🖥️' },
    { text: 'extension installer pro 🧩' },
    { text: 'timi ni coder banne hora? 🤨' },
    { text: 'ke garirako bro? 🤔' },
    { text: 'chal aaja try garna 💻' },
    { text: 'kaam chai ali kam vayo 😅' },
    { text: 'half-hearted grind, full-time excuse 🥴' },
    { text: 'u blinked and lost 3 hours 😵' },
    { text: 'the intention was there... somewhere 🕵️' },
    { text: 'power nap turned power hour 😴', theme: 'human' },
    { text: 'typing with 2 fingers, respect? nah 💅', theme: 'human' },
    { text: 'still doing it the hard way? 🐢', theme: 'human' },
    { text: 'u and ur keyboard, an untrusting pair ⌨️', theme: 'human' },
    { text: 'no AI to blame, just slow fingers 🐌', theme: 'human' },
    { text: 'hand-typed this slow? painstaking 🥲', theme: 'human' },
    { text: 'AI is calling, maybe pick up? 📞', theme: 'ai' },
    { text: 'u got a subscription, at least use it 💸', theme: 'ai' },
    { text: 'token money not being spent, sad 💵', theme: 'ai' },
    { text: 'the AI is bored waiting for u 🤖', theme: 'ai' },
    { text: 'u paid for the model then ignored it 🤡', theme: 'ai' },
    { text: 'the AI wrote more today than u did 💀', theme: 'ai' },
    { text: 'u whispered one prompt and called it a day 🤫', theme: 'ai' },
    { text: 'ur tokens are collecting dust 🪙', theme: 'ai' },
  ],
  templates: [
    { text: '{lang} haina ta, ali time chaincha 😮‍💨' },
    { text: 'ur top project is {project}? and yet... 🥱' },
  ],
};

const HARD: { pool: PoolLine[]; templates: TemplateLine[] } = {
  pool: [
    { text: 'bhai ta maryo kya ho 💀' },
    { text: 'laptop on toh hai? 💀' },
    { text: 'extinct ho kya? 🦖' },
    { text: 'are you alive? 👻' },
    { text: 'sasura gayab nai 🫥' },
    { text: 'neeche se first 1️⃣' },
    { text: 'tutorial hell escapee? 🌀' },
    { text: 'keyboard afraid of u? ⌨️' },
    { text: 'the IDE is dustier than ur browser history 🕸️' },
    { text: 'u exist, coding is optional I guess 🤷' },
    { text: 'dead last and proud? bold 💀' },
    { text: 'who hurt ur motivation 🩹' },
    { text: 'the benchwarmer of this squad 🪑' },
    { text: 'average idea, minimal execution 📉' },
    { text: 'code nahi, comedy garchas 😭' },
    { text: '2hrs and calling it a war? 😴' },
    { text: 'everyone else shipped, u napped 🚢' },
    { text: 'ur commits are a museum piece 🏛️' },
    { text: 'the grind skipped u, twice 🙃' },
    { text: 'bro found the power button finally 🔌' },
    { text: 'u barely coded, and it shows 📉', theme: 'human' },
    { text: 'human speed, sloth energy 🦥', theme: 'human' },
    { text: 'hand-typed this little? painstakingly slow 😵', theme: 'human' },
    { text: 'the era of AI slaves, and u are doing overtime as one 💀', theme: 'human' },
    { text: 'u really out here typing everything by hand for THAT? ✍️', theme: 'human' },
    { text: 'no AI, no excuses, no code 😤', theme: 'human' },
    { text: 'the machines won, u went home early 🏠', theme: 'human' },
    { text: 'u have AI money but zero time? weird flex 💰', theme: 'ai' },
    { text: 'bought the AI, used the trial, that\'s it? 🤡', theme: 'ai' },
    { text: 'ur AI is unemployed at this point 📉', theme: 'ai' },
    { text: 'even the bot gave up on u 🤖', theme: 'ai' },
    { text: 'u pay for tokens to not use them? 🪙', theme: 'ai' },
    { text: 'the AI is getting u fired with these numbers 📉', theme: 'ai' },
    { text: 'bought the max plan, produced the min code 💀', theme: 'ai' },
    { text: 'ur AI bill > ur code output, math isnt mathing 🧮', theme: 'ai' },
    { text: 'this board roasted u harder than I can 🔥' },
    { text: 'trailing so hard the leader is in another timezone ⏰' },
  ],
  templates: [
    { text: 'top language {lang} and STILL this? smh 😭', theme: 'human' },
    { text: 'u spent {hours}h total? a nap has more plot than this 😴' },
  ],
};

const SLACKER: { pool: PoolLine[]; templates: TemplateLine[] } = {
  pool: [
    { text: 'Laptop ta khol bhai 💀' },
    { text: 'Aaj ghumna jane ho?' },
    { text: 'Chiya churot break? ☕' },
    { text: 'Power button kasari press garne? 🔌' },
    { text: 'PC crashed? 💥' },
    { text: 'Internet kat-yo? 📡' },
    { text: 'Are bhai code ta lekh 👀' },
    { text: 'Hello World mai atkio?' },
    { text: 'Warmup chalira cha?' },
    { text: 'Just getting started? 🏃' },
    { text: 'Compilation time? ⏳' },
    { text: 'Installing dependencies? 📦' },
    { text: 'Git clone running? 🐌' },
    { text: '0 hours = 0 excuses 💀' },
    { text: 'the keyboard is in witness protection ⌨️' },
    { text: 'u looked at the laptop and said: nah 🚫' },
    { text: 'even the cursor is bored 🖱️' },
    { text: 'editor: untouched. aura: untouched. 🔒' },
    { text: 'somewhere, a startup is waiting for ur commit 🚀' },
    { text: 'u r the reason standby mode exists 🛌' },
    { text: 'the screen was off but the drama was on 📺' },
    { text: 'bro is speedrunning a day off 🏖️' },
    { text: 'idle time so long, the monitor fell asleep 😴' },
    { text: 'u know code doesnt write itself, right? (yet) 🤖', theme: 'ai' },
    { text: 'even AI cant help zero input 🤖', theme: 'ai' },
    { text: 'the AI is doing nothing and still beating u 😂', theme: 'ai' },
    { text: 'even a free AI model outworked u today 🤖', theme: 'ai' },
    { text: 'u n ur subscription, both idle 😴', theme: 'ai' },
    { text: 'the AI out-coded u by existing 💅', theme: 'ai' },
    { text: '0 hrs, but the subscription bill came anyway 💸', theme: 'ai' },
    { text: 'not even one manual keystroke? ✋', theme: 'human' },
    { text: '0 hours of human time, the keyboard is single 🕯️', theme: 'human' },
    { text: 'not a single line, not even a print() 😤', theme: 'human' },
    { text: 'day off sponsored by procrastination 🏖️', theme: 'human' },
    { text: 'hand-coders everywhere wept today ⌨️', theme: 'human' },
    { text: '0 hrs, but 100% confidence 💯' },
    { text: 'this is not a coding streak, it is a break 💤' },
    { text: 'u and the repo are strangers now 👋' },
    { text: 'did u even breathe on the keyboard today? 🌬️' },
    { text: 'rest day? everyday? 🛌' },
    { text: 'the only thing running today was ur mouth 🗣️' },
  ],
  templates: [],
};

const TIGHT_RACE: { pool: PoolLine[]; templates: TemplateLine[] } = {
  pool: [
    { text: 'everyone is a machine today 🫡' },
    { text: 'this board is too hot, gap itni tight 🔥' },
    { text: 'photo finish incoming 📸' },
    { text: 'nobody is safe in this lobby 💀' },
    { text: 'u r all insane today 🚀' },
    { text: 'rank 1 to rank last? all grinding 😤' },
    { text: 'tightest race of the week, no cap 🏁' },
    { text: 'u r last by seconds, basically winning 🥈' },
    { text: 'margins this thin, everyone gets a medal 🏅' },
    { text: 'the gap between u is a coffee break ☕' },
    { text: 'someone blink and the board flips 👁️' },
    { text: 'friendly neighbourhood sweat-fest 😅' },
    { text: 'all gas, no brakes out here 🏎️' },
    { text: 'hate to see it, love to code it 💻' },
    { text: 'u coded, I coded, we all coded 🤝' },
    { text: 'sab janne wale ho, koi peeche chaina 🤝', theme: 'human' },
    { text: 'hand-coded by everyone, respect the squad 🛠️', theme: 'human' },
    { text: 'everyone bringing hand-written heat today 🥵', theme: 'human' },
    { text: 'all of u paying the AI tax today 💸', theme: 'ai' },
    { text: 'the whole board is on token time 🤖', theme: 'ai' },
    { text: 'AI speedrun battle royale 🏆', theme: 'ai' },
  ],
  templates: [],
};

const ADMIN_LAST: PoolLine[] = [
  { text: 'Aaja dai le rest garchha' },
  { text: 'admin bhayera last? leadership example 😌' },
  { text: 'dai ni touch grass garchhan, jasto paisa? 🥬' },
  { text: 'the boss, resting on purpose 😎' },
];

const POOLS: Record<RoastTone, { pool: PoolLine[]; templates: TemplateLine[] }> = {
  god: GOD,
  praise: PRAISE,
  solid: SOLID,
  neutral: NEUTRAL,
  mild: MILD,
  hard: HARD,
  slacker: SLACKER,
};

// ------------------------------------------------------------------
// TONE DETERMINATION - the "polished algorithm"
// ------------------------------------------------------------------

function hoursOf(s: number): number {
  return s / 3600;
}

export function computeBoardStats(secondsList: number[], minMean = 3600): BoardStats {
  const total = secondsList.length;
  const active = secondsList.filter((s) => s > 0);
  const values = active.length > 0 ? active : [0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const activeRatio = total > 0 ? active.length / total : 0;

  return {
    min,
    max,
    mean,
    spreadRatio: max > 0 ? (max - min) / max : 0,
    // A "tight race" only exists once the competition has actually started:
    // at least 75% of the board must be active, the field must be close,
    // and the average active time must clear the threshold. Idle boards or
    // a lone active user never get competition praise.
    tightRace:
      max > 0 &&
      active.length >= 2 &&
      activeRatio >= 0.75 &&
      (max - min) / max < 0.2 &&
      mean >= minMean,
  };
}

export function detectTheme(
  ctx: RoastContext,
  force?: RoastTheme
): RoastTheme {
  if (force) return force;

  const aiRatio = ctx.totalSeconds > 0 ? ctx.aiSeconds / ctx.totalSeconds : 0;
  const totalLines = ctx.aiLines + ctx.humanLines;
  const lineRatio = totalLines > 0 ? ctx.aiLines / totalLines : aiRatio;

  const aiHeavy = aiRatio >= 0.3 || (ctx.totalSeconds > 0 && lineRatio >= 0.4);
  const humanPure =
    ctx.totalSeconds > 0 &&
    aiRatio <= 0.05 &&
    ctx.aiSeconds < 300 &&
    ctx.aiLines <= 5;

  if (aiHeavy) return 'ai';
  if (humanPure) return 'human';
  return 'balanced';
}

function determineTone(ctx: RoastContext): RoastTone {
  const hours = hoursOf(ctx.totalSeconds);

  // Note: the metric the board is ranked by is handled via `detectTheme`
  // (e.g. ranking by AI flips the message flavor to sarcasm) while the
  // tone here always reflects raw effort.

  if (ctx.totalSeconds < 60) return 'slacker';

  if (ctx.board.tightRace && hours >= 1) return 'praise';

  // Base tone from absolute effort
  let tone: RoastTone;
  if (hours < 1) tone = 'hard';
  else if (hours < 3) tone = 'neutral';
  else if (hours < 6) tone = 'solid';
  else if (hours < 9) tone = 'praise';
  else tone = 'god';

  // Positional modulation (only when the field is NOT a tight race)
  const isLast = ctx.rank === ctx.totalEntries && ctx.totalEntries >= 2;
  const isFirst = ctx.rank === 1;
  const belowMean = ctx.totalSeconds < ctx.board.mean;

  if (isFirst) {
    if (hours >= 6) return 'god';
    if (hours >= 3) return 'praise';
    if (hours >= 1) return 'neutral';
    return 'mild';
  }

  if (isLast) {
    if (hours < 2 && belowMean) return 'hard';
    if (hours < 3) return 'mild';
    if (belowMean) return 'neutral';
    return 'solid';
  }

  // Deep tail in a spread-out board
  const tailCut = Math.max(2, Math.ceil(ctx.totalEntries * 0.35));
  if (ctx.rank >= ctx.totalEntries - tailCut + 1 && hours < 3 && belowMean) {
    return hours < 1 ? 'hard' : 'mild';
  }

  return tone;
}

// ------------------------------------------------------------------
// SELECTION WITH NO-REPEAT ROTATION
// ------------------------------------------------------------------

function renderTemplate(text: string, ctx: RoastContext): string {
  return text
    .replace('{lang}', ctx.topLanguage || 'code')
    .replace('{editor}', ctx.topEditor || 'VSCode')
    .replace('{project}', ctx.topProject || 'sidequest')
    .replace('{hours}', Math.round(hoursOf(ctx.totalSeconds)).toString());
}

// ------------------------------------------------------------------
// PUBLIC API
// ------------------------------------------------------------------

export const TONE_STYLES: Record<RoastTone, string> = {
  god: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/70 dark:border-amber-900',
  praise: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200/70 dark:border-amber-900',
  solid: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200/70 dark:border-emerald-900',
  neutral: 'bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-400 border-slate-200/70 dark:border-zinc-700',
  mild: 'bg-orange-50 dark:bg-orange-950/25 text-orange-700 dark:text-orange-400 border-orange-200/70 dark:border-orange-900',
  hard: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200/70 dark:border-red-900',
  slacker: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200/70 dark:border-red-900',
};

export const TONE_LABELS: Record<RoastTone, string> = {
  god: 'god-mode',
  praise: 'praise',
  solid: 'solid',
  neutral: 'neutral',
  mild: 'mild-roast',
  hard: 'hard-roast',
  slacker: 'slacker',
};

export function getRoast(
  ctx: RoastContext,
  seen: string[],
  usedTexts?: Set<string>
): RoastResult {
  // Admin trailing special case
  if (ctx.isAdmin && ctx.rank === ctx.totalEntries && ctx.totalEntries > 1) {
    const line = ADMIN_LAST[Math.floor(Math.random() * ADMIN_LAST.length)];
    usedTexts?.add(line.text);
    return { text: line.text, tone: 'neutral' };
  }

  const metricTheme: RoastTheme | undefined =
    ctx.metric === 'ai' || ctx.metric === 'lines' ? 'ai' : undefined;

  const tone = determineTone(ctx);
  const theme = detectTheme(ctx, metricTheme);
  const { pool, templates } = POOLS[tone];

  // Theme-forward selection: when the user clearly leans AI (or human-only),
  // give the theme-specific lines the spotlight most days, with occasional
  // generic lines for variety. Pools are large enough to stay fresh.
  const themed = pool.filter((l) => l.theme === theme);
  const generic = pool.filter((l) => l.theme === undefined);
  const preferTheme = themed.length > 0 && Math.random() < 0.75;

  let baseLines: PoolLine[];
  if (preferTheme) {
    baseLines = themed;
  } else {
    baseLines = generic.length > 0 ? generic : pool;
  }

  const templated = templates.filter(
    (t) =>
      (t.theme === undefined || t.theme === theme) &&
      (!t.text.includes('{lang}') || !!ctx.topLanguage) &&
      (!t.text.includes('{editor}') || !!ctx.topEditor) &&
      (!t.text.includes('{project}') || !!ctx.topProject)
  );

  let candidates = baseLines.concat(
    templated.map((t) => ({ text: renderTemplate(t.text, ctx) }))
  );

  // When the whole board is grinding shoulder-to-shoulder, sprinkle in the
  // dedicated tight-race lines alongside the regular pool.
  if (ctx.board.tightRace) {
    candidates = candidates.concat(
      TIGHT_RACE.pool.filter(
        (l) => l.theme === undefined || l.theme === theme
      )
    );
  }

  if (candidates.length === 0) candidates = pool;

  const fresh = candidates.filter(
    (c) => !seen.includes(c.text) && !usedTexts?.has(c.text)
  );
  const finalPool = fresh.length >= 3 ? fresh : candidates;
  const chosen = finalPool[Math.floor(Math.random() * finalPool.length)];
  usedTexts?.add(chosen.text);

  return { text: chosen.text, tone };
}

// ------------------------------------------------------------------
// SEEN-BUFFER HELPERS (localStorage-backed, browser only)
// ------------------------------------------------------------------

const SEEN_KEY = 'wakalead:roastSeen';
const SEEN_LIMIT = 12;

function loadSeenMap(): Record<number, string[]> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getSeenMessages(userId: number): string[] {
  if (typeof window === 'undefined') return [];
  const map = loadSeenMap();
  return map[userId] || [];
}

export function rememberMessage(userId: number, text: string): void {
  if (typeof window === 'undefined') return;
  const map = loadSeenMap();
  const list = map[userId] || [];
  if (!list.includes(text)) {
    list.push(text);
    if (list.length > SEEN_LIMIT) list.splice(0, list.length - SEEN_LIMIT);
    map[userId] = list;
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(map));
    } catch {
      /* storage full / unavailable - non-critical */
    }
  }
}

// ------------------------------------------------------------------
// BOARD-LEVEL CACHE - keeps roasts stable until the data actually
// changes (a real sync). Keyed by a signature of everything that can
// affect a roast, so reloads / tab switches never re-roll comments.
// ------------------------------------------------------------------

const BOARD_KEY = 'wakalead:boardRoasts';

interface SignatureEntry {
  user_id: number;
  rank: number;
  total_seconds: number;
  ai_seconds: number;
  human_seconds: number;
  ai_lines: number;
  human_lines: number;
  all_time_seconds?: number;
  top_language?: string | null;
  top_editor?: string | null;
  top_project?: string | null;
  is_admin?: boolean;
}

export interface BoardCache {
  signature: string;
  results: Record<number, RoastResult>;
  board: BoardStats;
}

/** Deterministic fingerprint of a board + metric. Same data => same roast. */
export function boardSignature(metric: string, ranked: SignatureEntry[]): string {
  return JSON.stringify([
    metric,
    ranked.map((e) => [
      e.user_id,
      e.rank,
      e.total_seconds,
      e.ai_seconds,
      e.human_seconds,
      e.ai_lines,
      e.human_lines,
      e.all_time_seconds ?? 0,
      e.top_language ?? '',
      e.top_editor ?? '',
      e.top_project ?? '',
      e.is_admin ? 1 : 0,
    ]),
  ]);
}

export function getBoardCache(): BoardCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BOARD_KEY);
    return raw ? (JSON.parse(raw) as BoardCache) : null;
  } catch {
    return null;
  }
}

export function setBoardCache(cache: BoardCache): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BOARD_KEY, JSON.stringify(cache));
  } catch {
    /* storage full / unavailable - non-critical */
  }
}
