// Comprehensive content moderation and abusive language filter for WriteMyWords
// Ensures respectful, academic, and safe communication between students and experts.

const RESTRICTED_PATTERNS = [
  // English profanities, slurs, insults, threats
  /\b(fuck|fucker|fucking|f\*ck|fuk|fck)\b/i,
  /\b(shit|shitty|sh\*t|bullshit|bull crap)\b/i,
  /\b(asshole|ass|arse|bitch|bastard|dick|cock|pussy|slut|whore|cunt)\b/i,
  /\b(nigger|nigga|chink|faggot|retard|idiot|dumbass|moron|scumbag)\b/i,
  /\b(kill yourself|die|go to hell|scam you|rob you|beat you up|abuse)\b/i,
  
  // Hindi / Hinglish abusive / harsh words
  /\b(madarchod|mc|bhenchod|bc|bhosdike|bhosadi|chutiya|chutiye|gandu|lauda|lodu|harami|kameena|saale|randi|kutte|choot|gaand)\b/i,
  /\b(teri maa|teri behen|kutta|kamina|suar|behen ke|bhen ke)\b/i,
];

/**
 * Checks if text contains abusive, harsh, or restricted words.
 * @param {string} text 
 * @returns {{ isClean: boolean, matchedWord: string | null }}
 */
export function validateMessageContent(text) {
  if (!text || typeof text !== 'string') {
    return { isClean: true, matchedWord: null };
  }

  const clean = text.trim();
  for (const pattern of RESTRICTED_PATTERNS) {
    const match = clean.match(pattern);
    if (match) {
      return {
        isClean: false,
        matchedWord: match[0],
      };
    }
  }

  return { isClean: true, matchedWord: null };
}

/**
 * Replaces abusive words with asterisks if needed
 * @param {string} text 
 * @returns {string}
 */
export function sanitizeMessageText(text) {
  if (!text) return '';
  let sanitized = text;
  for (const pattern of RESTRICTED_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => '*'.repeat(match.length));
  }
  return sanitized;
}
