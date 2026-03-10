const ROUTING_DB: Record<string, string> = {
  // ── JP Morgan Chase ─────────────────────────────────────────────────────────
  "021000021": "JPMorgan Chase Bank",
  "021000322": "JPMorgan Chase Bank",
  "022000046": "JPMorgan Chase Bank",
  "022000248": "JPMorgan Chase Bank",
  "071000013": "JPMorgan Chase Bank",
  "072000326": "JPMorgan Chase Bank",
  "074000078": "JPMorgan Chase Bank",
  "075000022": "JPMorgan Chase Bank",
  "111000614": "JPMorgan Chase Bank",
  "113000023": "JPMorgan Chase Bank",
  "121202211": "JPMorgan Chase Bank",
  "122235821": "JPMorgan Chase Bank",
  "124000054": "JPMorgan Chase Bank",
  "125000024": "JPMorgan Chase Bank",
  "322271627": "JPMorgan Chase Bank",

  // ── Bank of America ──────────────────────────────────────────────────────────
  "021001088": "Bank of America",
  "021101108": "Bank of America",
  "021409169": "Bank of America",
  "026009593": "Bank of America",
  "026013673": "Bank of America",
  "031312738": "Bank of America",
  "051000017": "Bank of America",
  "051400549": "Bank of America",
  "054001204": "Bank of America",
  "061000052": "Bank of America",
  "063000047": "Bank of America",
  "064000059": "Bank of America",
  "111000025": "Bank of America",
  "121000358": "Bank of America",
  "122000661": "Bank of America",
  "122100024": "Bank of America",
  "122400724": "Bank of America",
  "307070005": "Bank of America",

  // ── Wells Fargo ──────────────────────────────────────────────────────────────
  "031000053": "Wells Fargo Bank",
  "053000196": "Wells Fargo Bank",
  "061000227": "Wells Fargo Bank",
  "061092387": "Wells Fargo Bank",
  "073000228": "Wells Fargo Bank",
  "091000022": "Wells Fargo Bank",
  "091901480": "Wells Fargo Bank",
  "107000327": "Wells Fargo Bank",
  "112000066": "Wells Fargo Bank",
  "121000248": "Wells Fargo Bank",
  "121042882": "Wells Fargo Bank",
  "122000247": "Wells Fargo Bank",
  "123002011": "Wells Fargo Bank",
  "261070015": "Wells Fargo Bank",
  "291070001": "Wells Fargo Bank",
  "321070007": "Wells Fargo Bank",

  // ── Citibank ─────────────────────────────────────────────────────────────────
  "021000089": "Citibank",
  "021302567": "Citibank",
  "021912915": "Citibank",
  "067011140": "Citibank",
  "071025661": "Citibank",
  "071921891": "Citibank",
  "122000030": "Citibank",
  "122401710": "Citibank",
  "271070801": "Citibank (formerly Discover Bank)",

  // ── US Bank ──────────────────────────────────────────────────────────────────
  "042000013": "U.S. Bank",
  "054001220": "U.S. Bank",
  "073000176": "U.S. Bank",
  "081000032": "U.S. Bank",
  "081000210": "U.S. Bank",
  "082000073": "U.S. Bank",
  "083000137": "U.S. Bank",
  "091000019": "U.S. Bank",
  "101000695": "U.S. Bank",
  "122003396": "U.S. Bank",
  "123000220": "U.S. Bank",

  // ── PNC Bank ─────────────────────────────────────────────────────────────────
  "021407912": "PNC Bank",
  "031100209": "PNC Bank",
  "031101169": "PNC Bank",
  "031201360": "PNC Bank",
  "036001808": "PNC Bank",
  "041000153": "PNC Bank",
  "042100175": "PNC Bank",
  "043000096": "PNC Bank",
  "083000108": "PNC Bank",

  // ── TD Bank ──────────────────────────────────────────────────────────────────
  "021272655": "TD Bank",
  "031176110": "TD Bank",
  "031207607": "TD Bank",
  "211070175": "TD Bank",
  "221172610": "TD Bank",
  "222370440": "TD Bank",
  "226071004": "TD Bank",
  "231372691": "TD Bank",

  // ── Truist (formerly BB&T / SunTrust) ────────────────────────────────────────
  "031202084": "Truist Bank",
  "051000020": "Truist Bank",
  "053000219": "Truist Bank",
  "053902197": "Truist Bank",
  "061000104": "Truist Bank",
  "063100277": "Truist Bank",
  "064000017": "Truist Bank",
  "253177049": "Truist Bank",
  "254070116": "Truist Bank",

  // ── Capital One ──────────────────────────────────────────────────────────────
  "065000171": "Capital One",
  "113010547": "Capital One",
  "255071981": "Capital One",

  // ── Regions Bank ─────────────────────────────────────────────────────────────
  "031301422": "Regions Bank",
  "053200983": "Regions Bank",
  "061100606": "Regions Bank",
  "062000019": "Regions Bank",
  "062000080": "Regions Bank",
  "065000090": "Regions Bank",
  "081202759": "Regions Bank",
  "082000549": "Regions Bank",
  "084000026": "Regions Bank",

  // ── USAA Federal Savings Bank ─────────────────────────────────────────────────
  "314074269": "USAA Federal Savings Bank",

  // ── Navy Federal Credit Union ─────────────────────────────────────────────────
  "051503394": "Navy Federal Credit Union",
  "061103852": "Navy Federal Credit Union",
  "062203751": "Navy Federal Credit Union",
  "063107513": "Navy Federal Credit Union",
  "065305436": "Navy Federal Credit Union",
  "067014822": "Navy Federal Credit Union",
  "074908594": "Navy Federal Credit Union",
  "075911988": "Navy Federal Credit Union",
  "091904010": "Navy Federal Credit Union",
  "111900659": "Navy Federal Credit Union",
  "113024588": "Navy Federal Credit Union",
  "114903284": "Navy Federal Credit Union",
  "121140399": "Navy Federal Credit Union",
  "122016066": "Navy Federal Credit Union",
  "231381116": "Navy Federal Credit Union",
  "256074974": "Navy Federal Credit Union",
  "263079804": "Navy Federal Credit Union",
  "267084131": "Navy Federal Credit Union",
  "281073568": "Navy Federal Credit Union",
  "302075830": "Navy Federal Credit Union",
  "311079573": "Navy Federal Credit Union",
  "314089681": "Navy Federal Credit Union",
  "321081669": "Navy Federal Credit Union",
  "322070381": "Navy Federal Credit Union",
  "325070760": "Navy Federal Credit Union",

  // ── Ally Bank ────────────────────────────────────────────────────────────────
  "081904808": "Ally Bank",
  "124003116": "Ally Bank",

  // ── Charles Schwab Bank ───────────────────────────────────────────────────────
  "111017694": "Charles Schwab Bank",
  "282076588": "Charles Schwab Bank",

  // ── Discover Bank ────────────────────────────────────────────────────────────
  "031100649": "Discover Bank",

  // ── KeyBank ──────────────────────────────────────────────────────────────────
  "021502011": "KeyBank",
  "022300173": "KeyBank",
  "041000124": "KeyBank",
  "041001039": "KeyBank",
  "073000545": "KeyBank",

  // ── Huntington National Bank ─────────────────────────────────────────────────
  "041202582": "Huntington National Bank",
  "041215032": "Huntington National Bank",
  "044000037": "Huntington National Bank",
  "072403004": "Huntington National Bank",
  "241070417": "Huntington National Bank",

  // ── Fifth Third Bank ─────────────────────────────────────────────────────────
  "042000314": "Fifth Third Bank",
  "072000805": "Fifth Third Bank",
  "074000010": "Fifth Third Bank",

  // ── M&T Bank ─────────────────────────────────────────────────────────────────
  "031302955": "M&T Bank",
  "022300251": "M&T Bank (formerly People's United)",

  // ── Citizens Bank ────────────────────────────────────────────────────────────
  "031901482": "Citizens Bank",
  "211170101": "Citizens Bank",
  "036076150": "Citizens Bank",

  // ── HSBC Bank USA ────────────────────────────────────────────────────────────
  "021200339": "HSBC Bank USA",
  "021202337": "HSBC Bank USA",
  "031100157": "HSBC Bank USA",

  // ── BMO Harris Bank ──────────────────────────────────────────────────────────
  "071000288": "BMO Bank",
  "075000019": "BMO Bank",

  // ── Comerica Bank ────────────────────────────────────────────────────────────
  "072000096": "Comerica Bank",
  "111000753": "Comerica Bank",

  // ── Frost Bank ───────────────────────────────────────────────────────────────
  "114000093": "Frost Bank",

  // ── Zions Bank ───────────────────────────────────────────────────────────────
  "107002192": "Zions Bank",
  "124001545": "Zions Bank",

  // ── First Horizon Bank ───────────────────────────────────────────────────────
  "084009519": "First Horizon Bank",

  // ── Commerce Bank ────────────────────────────────────────────────────────────
  "081000045": "Commerce Bank",
  "081000100": "Commerce Bank",
  "101089292": "Commerce Bank",

  // ── Synovus Bank ─────────────────────────────────────────────────────────────
  "061020016": "Synovus Bank",

  // ── Associated Bank ──────────────────────────────────────────────────────────
  "091300023": "Associated Bank",

  // ── Green Dot Bank ───────────────────────────────────────────────────────────
  "073972181": "Green Dot Bank",
  "124303065": "Green Dot Bank",

  // ── Alliant Credit Union ─────────────────────────────────────────────────────
  "271071321": "Alliant Credit Union",

  // ── Golden 1 Credit Union ────────────────────────────────────────────────────
  "121100782": "Golden 1 Credit Union",
  "122105155": "Golden 1 Credit Union",

  // ── Lake Michigan Credit Union ───────────────────────────────────────────────
  "272471852": "Lake Michigan Credit Union",

  // ── Mountain America Credit Union ───────────────────────────────────────────
  "324302150": "Mountain America Credit Union",

  // ── Delta Community Credit Union ─────────────────────────────────────────────
  "261071315": "Delta Community Credit Union",

  // ── Logix Federal Credit Union ───────────────────────────────────────────────
  "322278141": "Logix Federal Credit Union",

  // ── Tinker Federal Credit Union ──────────────────────────────────────────────
  "103113357": "Tinker Federal Credit Union",

  // ── Apple Federal Credit Union ───────────────────────────────────────────────
  "121141822": "Apple Federal Credit Union",

  // ── First National Bank of Omaha ─────────────────────────────────────────────
  "104000016": "First National Bank of Omaha",

  // ── Arvest Bank ──────────────────────────────────────────────────────────────
  "103100195": "Arvest Bank",

  // ── Bank of Oklahoma ─────────────────────────────────────────────────────────
  "103000648": "Bank of Oklahoma",

  // ── First Citizens Bank ──────────────────────────────────────────────────────
  "053100300": "First Citizens Bank",
  "053207766": "First Citizens Bank",

  // ── Pinnacle Bank ────────────────────────────────────────────────────────────
  "064103707": "Pinnacle Bank",

  // ── Banner Bank ──────────────────────────────────────────────────────────────
  "125008547": "Banner Bank",

  // ── Columbia Bank ────────────────────────────────────────────────────────────
  "125200057": "Columbia Bank",

  // ── Rockland Trust ───────────────────────────────────────────────────────────
  "211274450": "Rockland Trust",

  // ── Centennial Bank ──────────────────────────────────────────────────────────
  "063102152": "Centennial Bank",

  // ── Pacific Western Bank / PacWest ───────────────────────────────────────────
  "121002042": "Pacific Premier Bank",

  // ── Wintrust Financial ───────────────────────────────────────────────────────
  "071904779": "Wintrust Bank",

  // ── Bremer Bank ──────────────────────────────────────────────────────────────
  "091000080": "Bremer Bank",

  // ── UMB Financial ────────────────────────────────────────────────────────────
  "101000019": "UMB Bank",

  // ── Capitol Federal Savings ──────────────────────────────────────────────────
  "101205681": "Capitol Federal Savings",

  // ── FirstBank ────────────────────────────────────────────────────────────────
  "107005047": "FirstBank",

  // ── Provident Credit Union ───────────────────────────────────────────────────
  "121137522": "Provident Credit Union",

  // ── People's United (now M&T) ────────────────────────────────────────────────
  "211370545": "People's United Bank (now M&T Bank)",

  // ── Synchrony Bank ───────────────────────────────────────────────────────────
  "021213591": "Synchrony Bank",
  "031101186": "Synchrony Bank",

  // ── Marcus by Goldman Sachs ──────────────────────────────────────────────────
  "124085024": "Goldman Sachs Bank USA",
  "026015079": "Goldman Sachs Bank USA",

  // ── American Express National Bank ───────────────────────────────────────────
  "124071889": "American Express National Bank",

  // ── Sofi Bank ────────────────────────────────────────────────────────────────
  "031101533": "SoFi Bank",
  "084209745": "SoFi Bank",

  // ── Chime (The Bancorp / Stride Bank) ────────────────────────────────────────
  "031101279": "Chime (Bancorp Bank)",
  "103112675": "Chime (Stride Bank)",

  // ── CashApp / Sutton Bank ────────────────────────────────────────────────────
  "041215663": "Cash App (Sutton Bank)",

  // ── Varo Bank ────────────────────────────────────────────────────────────────
  "103112596": "Varo Bank",

  // ── Axos Bank ────────────────────────────────────────────────────────────────
  "122287675": "Axos Bank",
  "124271978": "Axos Bank",

  // ── BBVA (now PNC) ───────────────────────────────────────────────────────────
  "062005690": "PNC Bank (formerly BBVA)",
  "112200567": "PNC Bank (formerly BBVA)",

  // ── Union Bank (now US Bank) ─────────────────────────────────────────────────
  "122000496": "U.S. Bank (formerly Union Bank)",

  // ── Signature Bank / Flagstar Bank ──────────────────────────────────────────
  "026013576": "Flagstar Bank",
  "272484872": "Flagstar Bank",
};

export function lookupLocal(routingNumber: string): string | null {
  return ROUTING_DB[routingNumber] ?? null;
}
