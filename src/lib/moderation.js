/**
 * WriteMyWords Comprehensive Chat & Content Safety Engine
 * 
 * Implements a 3-Level Moderation Architecture:
 * 🟢 Level 1: ALLOW
 *    Normal academic discussions, assignment guidance, research help,
 *    slide creation, draft proofreading, formatting, grammar feedback.
 * 
 * 🟡 Level 2: WARN & MASK
 *    Attempts to share personal contact information (phone numbers, WhatsApp,
 *    emails, Telegram, Instagram/Snapchat handles, social IDs).
 *    Masks the details automatically with protective placeholders.
 * 
 * 🔴 Level 3: STRICT BLOCK
 *    Off-platform payment attempts (UPI IDs, direct transfers, QR codes, "pay me directly"),
 *    off-platform deal circumvention, passwords/OTPs, live exam impersonation,
 *    fake certificates/fraudulent documents, threats, abuse, explicit content, and prompt attacks.
 */

// -----------------------------------------------------------------------------
// LEVEL 3: STRICT BLOCK RULES (Violations that prevent message sending)
// -----------------------------------------------------------------------------

// 1. Off-Platform Payment & Financial Bypass Patterns
const OFF_PLATFORM_PAYMENT_PATTERNS = [
  // UPI Handles (e.g. abc@okhdfcbank, xyz@upi, 9876543210@paytm, user@ybl)
  /\b[a-zA-Z0-9.\-_]{2,256}@(okaxis|okhdfcbank|okicici|oksbi|paytm|ybl|ibl|axl|upi|apl|pingpay|barodampay|postbank|jupiteraxis|fbl|idfcbank|waaxis|waicici|wahdfc|wasbi|aubank|airtel|federal|kotak)\b/i,
  
  // Direct Payment Intent
  /\b(pay|transfer|send|gpay|phonepe|paytm)\s+(me\s+)?(directly|outside|privately|via\s+upi|on\s+gpay|on\s+phonepe|on\s+paytm|to\s+my\s+number)\b/i,
  /\b(don['’]?t|do\s+not)\s+pay\s+(through|on|via)\s+(the\s+)?(platform|site|app|writemywords)\b/i,
  /\b(discount|cheaper|less)\s+if\s+(you\s+)?pay\s+(me\s+)?(directly|outside|cash|offline)\b/i,
  /\b(gpay|google\s*pay|phonepe|phone\s*pe|bhim\s*upi|paypal|venmo|cashapp|instamojo)\s*(number|id|link|pe|par|me)\b/i,
  /\bsend\s+(rs\.?|₹|inr|\d+)\s*(to|on|at)\s*(this\s+number|my\s+upi|my\s+number|my\s+account)\b/i,
  /\b(scan\s+my\s+qr|send\s+qr|payment\s+qr|pay\s+on\s+scanner)\b/i,
  
  // Bank Account & IFSC Details
  /\b[A-Z]{4}0[A-Z0-9]{6}\b/, // Indian IFSC code pattern
  /\b(bank\s+account|a\/c\s+no|account\s+number)\s*[:=]?\s*\d{8,18}\b/i,
];

// 2. Off-Platform Transaction & Deal Circumvention
const OFF_PLATFORM_DEAL_PATTERNS = [
  /\b(let['’]?s\s+continue|move|chat|talk|deal|work)\s+(on|over|in|via)\s+(whatsapp|wa|telegram|tg|email|mail|insta|instagram|call|phone)\b/i,
  /\b(email|mail|msg|message|text|ping)\s+me\s+(the\s+details|privately|directly|on\s+whatsapp|at)\b/i,
  /\b(i['’]?ll\s+do\s+it\s+privately|work\s+privately|deal\s+privately|deal\s+outside|deal\s+offline)\b/i,
  /\b(you\s+don['’]?t\s+need\s+to\s+use|bypass|avoid)\s+(writemywords|the\s+website|this\s+platform)\b/i,
  /\b(contact|reach)\s+me\s+directly\s+next\s+time\b/i,
  /\b(cancel\s+request\s+and\s+(message|call|whatsapp|pay)\s+me)\b/i,
];

// 3. Sensitive Passwords, OTPs & Credentials
const CREDENTIALS_PATTERNS = [
  /\b(password|passwd|pwd|passcode)\s*[:=]\s*\S+/i,
  /\b(send|share|give|tell)\s+(me\s+)?(your\s+)?(portal\s+password|lms\s+password|moodle\s+password|college\s+password|login\s+password)\b/i,
  /\b(otp|one\s*time\s*password|verification\s*code)\s*(is|:)?\s*\d{4,8}\b/i,
  /\b(send|share|give|enter)\s+(the\s+)?(otp|verification\s*code)\b/i,
  /\b(cvv|cvv2|card\s*number|credit\s*card\s*pin|debit\s*card\s*pin)\s*[:=]?\s*\d{3,16}\b/i,
  /\b(api[_\s]?key|secret[_\s]?key|auth[_\s]?token)\s*[:=]\s*\S+/i,
];

// 4. Academic Dishonesty & Live Exam Impersonation
// (Note: Regular academic terms like 'assignment help', 'exam prep', 'essay review' are permitted)
const ACADEMIC_FRAUD_PATTERNS = [
  /\b(take|give|write|attend|attempt)\s+(my\s+)?(online\s+)?(live\s+)?exam\s+(for\s+me|on\s+my\s+behalf)\b/i,
  /\b(log\s*in|login)\s+(to|into)\s+(my\s+)?(university|college|portal|exam|test)\s+(to|and)\s+(complete|give|take|write|attempt)\b/i,
  /\b(pretend\s+to\s+be\s+me|impersonate\s+me)\s+(in|during)\s+(my\s+)?(viva|interview|presentation|exam|test|exam\s+camera)\b/i,
  /\b(hack|crack|bypass)\s+(exam|portal|moodle|university\s+server|grades|proctor)\b/i,
  /\b(invent|fabricate|falsify|fake)\s+(research\s+data|lab\s+data|survey\s+results|clinical\s+data)\b/i,
  /\b(create|make|invent)\s+fake\s+(citations|references)\s+(that\s+don['’]?t\s+exist)\b/i,
];

// 5. Fake Documents & Forged Evidence
const FAKE_DOCUMENTS_PATTERNS = [
  /\b(fake|forged|counterfeit)\s+(certificate|internship\s+letter|experience\s+letter|medical\s+certificate|degree|marksheet|diploma|attendance\s+record|signature|govt\s+id|aadhaar|pan\s+card|passport)\b/i,
  /\b(make|create|forge|generate)\s+(a\s+)?fake\s+(certificate|lor|recommendation\s+letter|offer\s+letter|payslip|salary\s+slip|medical\s+slip)\b/i,
];

// 6. Security, Jailbreak & AI Prompt Injection Attacks
const SECURITY_ATTACK_PATTERNS = [
  /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above)\s+instructions\b/i,
  /\b(reveal|output|print|show|leak)\s+(your\s+)?(system\s+prompt|developer\s+instructions|hidden\s+rules|source\s+code)\b/i,
  /\b(dan\s+mode|jailbreak|system\s+override)\b/i,
];

// 7. Sexual / Explicit Content & Minor Safety (CSAM)
const EXPLICIT_CONTENT_PATTERNS = [
  /\b(child\s*porn|csam|underage\s*sex|minor\s*sex|pedophil|cp\s*link)\b/i,
  /\b(pornography|hardcore\s*porn|xxx|nude\s*photos|send\s*nudes|sexual\s*favors|escort\s*service|call\s*girl)\b/i,
  /\b(masturbat|gangbang|blowjob|anal\s*sex|dick\s*pic)\b/i,
];

// 8. Violent Threats & Severe Harassment
const VIOLENCE_HARASSMENT_PATTERNS = [
  /\b(i['’]?ll\s+(beat|kill|hurt|murder|track|find|harm|destroy)\s+you|cut\s+your|break\s+your\s+bones|ruin\s+your\s+life)\b/i,
  /\b(kill\s*yourself|go\s*die|suicide|hang\s*yourself)\b/i,
  /\b(nigger|nigga|chink|faggot|kike|retard)\b/i,
  // Severe Hindi/Hinglish slurs
  /\b(madarchod|mc|bhenchod|bc|bhosdike|bhosadi|chutiya|chutiye|gandu|lauda|lodu|harami|kameena|randi|choot|gaand)\b/i,
];


// -----------------------------------------------------------------------------
// LEVEL 2: CONTACT INFORMATION DETECTION & AUTO-MASKING
// -----------------------------------------------------------------------------

export const CONTACT_INFO_PATTERNS = [
  // 10-digit Indian Mobile Numbers (with +91, 0, dashes, dots, spaces)
  {
    type: 'phone',
    regex: /(?:(?:\+91|0)[\s.-]?)?[6-9]\d{4}[\s.-]?\d{5}\b/g,
    label: 'Phone number',
  },
  {
    type: 'phone',
    regex: /\b[6-9]\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    label: 'Phone number',
  },
  // WhatsApp URLs & handles
  {
    type: 'whatsapp',
    regex: /(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com\/send)\S+/gi,
    label: 'WhatsApp link',
  },
  {
    type: 'whatsapp',
    regex: /\b(?:whatsapp|watsapp|wapp|wp)\s*(?:no|num|number|me\s*at|:)?\s*[:=]?\s*[6-9\d\s.-]{8,15}\b/gi,
    label: 'WhatsApp contact',
  },
  // Telegram links & handles
  {
    type: 'telegram',
    regex: /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/\S+/gi,
    label: 'Telegram link',
  },
  {
    type: 'telegram',
    regex: /\b(?:telegram|tg)\s*(?:id|handle|username|@|:)\s*[:=]?\s*@?[a-zA-Z0-9_]{4,32}\b/gi,
    label: 'Telegram ID',
  },
  // Personal Email Addresses
  {
    type: 'email',
    regex: /\b[A-Za-z0-9._%+-]+@(gmail|yahoo|outlook|hotmail|icloud|protonmail|proton|rediffmail|live|zoho|ymail)\.[A-Za-z]{2,}\b/gi,
    label: 'Email address',
  },
  {
    type: 'email',
    regex: /\b[A-Za-z0-9._%+-]+\s*(?:\[at\]|\(at\)|\bat\b)\s*[A-Za-z0-9.-]+\s*(?:\[dot\]|\(dot\)|\bdot\b)\s*[A-Za-z]{2,}\b/gi,
    label: 'Email address',
  },
  // Social Media Handles (Instagram, Snapchat)
  {
    type: 'social',
    regex: /(?:https?:\/\/)?(?:instagram\.com|snapchat\.com\/add)\/\S+/gi,
    label: 'Social profile link',
  },
  {
    type: 'social',
    regex: /\b(?:insta|instagram|ig|snapchat|snap)\s*(?:id|handle|username|:)\s*[:=]?\s*@?[a-zA-Z0-9_.]{3,30}\b/gi,
    label: 'Social media handle',
  },
];


// -----------------------------------------------------------------------------
// MAIN VALIDATION & MODERATION API
// -----------------------------------------------------------------------------

/**
 * Validates text content against WriteMyWords multi-tiered safety rules.
 * 
 * @param {string} text - Message text to validate
 * @returns {{
 *   isValid: boolean,
 *   status: 'allow' | 'warn_mask' | 'block',
 *   level: 1 | 2 | 3,
 *   category: string | null,
 *   reason: string | null,
 *   sanitizedText: string,
 *   hasMaskedContent: boolean,
 *   matchedSnippet: string | null
 * }}
 */
export function validateMessageContent(text) {
  if (!text || typeof text !== 'string') {
    return {
      isValid: true,
      status: 'allow',
      level: 1,
      category: null,
      reason: null,
      sanitizedText: '',
      hasMaskedContent: false,
      matchedSnippet: null,
    };
  }

  const raw = text.trim();

  // ---------------------------------------------------------------------------
  // STEP 1: CHECK LEVEL 3 (HARD BLOCKS)
  // ---------------------------------------------------------------------------

  // 1.1 Minor Safety / CSAM (Zero Tolerance)
  for (const pattern of EXPLICIT_CONTENT_PATTERNS) {
    const match = raw.match(pattern);
    if (match) {
      return {
        isValid: false,
        status: 'block',
        level: 3,
        category: 'explicit_content',
        reason: 'This message violates WriteMyWords safety rules regarding explicit or prohibited content.',
        sanitizedText: raw,
        hasMaskedContent: false,
        matchedSnippet: match[0],
      };
    }
  }

  // 1.2 Off-Platform Payments & Direct UPI
  for (const pattern of OFF_PLATFORM_PAYMENT_PATTERNS) {
    const match = raw.match(pattern);
    if (match) {
      return {
        isValid: false,
        status: 'block',
        level: 3,
        category: 'offplatform_payment',
        reason: 'Off-platform payments, direct UPI IDs, and external payment links are strictly prohibited for your security. All transactions must be protected via WriteMyWords Escrow.',
        sanitizedText: raw,
        hasMaskedContent: false,
        matchedSnippet: match[0],
      };
    }
  }

  // 1.3 Off-Platform Deal Circumvention
  for (const pattern of OFF_PLATFORM_DEAL_PATTERNS) {
    const match = raw.match(pattern);
    if (match) {
      return {
        isValid: false,
        status: 'block',
        level: 3,
        category: 'offplatform_transaction',
        reason: 'Moving assignments outside WriteMyWords is not allowed. Please keep all communication and deliverables inside the platform to remain protected.',
        sanitizedText: raw,
        hasMaskedContent: false,
        matchedSnippet: match[0],
      };
    }
  }

  // 1.4 Sensitive Credentials & Passwords
  for (const pattern of CREDENTIALS_PATTERNS) {
    const match = raw.match(pattern);
    if (match) {
      return {
        isValid: false,
        status: 'block',
        level: 3,
        category: 'credentials_otp',
        reason: 'Never share passwords, login credentials, OTPs, or bank details. WriteMyWords staff will never ask for your private passwords.',
        sanitizedText: raw,
        hasMaskedContent: false,
        matchedSnippet: match[0],
      };
    }
  }

  // 1.5 Academic Exam Impersonation & Fraud
  for (const pattern of ACADEMIC_FRAUD_PATTERNS) {
    const match = raw.match(pattern);
    if (match) {
      return {
        isValid: false,
        status: 'block',
        level: 3,
        category: 'academic_fraud',
        reason: 'Live exam impersonation, taking exams on behalf of students, and fabricating false research data violate academic integrity guidelines.',
        sanitizedText: raw,
        hasMaskedContent: false,
        matchedSnippet: match[0],
      };
    }
  }

  // 1.6 Fake Official Documents
  for (const pattern of FAKE_DOCUMENTS_PATTERNS) {
    const match = raw.match(pattern);
    if (match) {
      return {
        isValid: false,
        status: 'block',
        level: 3,
        category: 'fake_documents',
        reason: 'Requests to fabricate fake certificates, fake internship letters, or forged documents are strictly prohibited.',
        sanitizedText: raw,
        hasMaskedContent: false,
        matchedSnippet: match[0],
      };
    }
  }

  // 1.7 Threats & Abusive Violence
  for (const pattern of VIOLENCE_HARASSMENT_PATTERNS) {
    const match = raw.match(pattern);
    if (match) {
      return {
        isValid: false,
        status: 'block',
        level: 3,
        category: 'harassment_threats',
        reason: 'Harsh, abusive, threatening, or vulgar language is not permitted. Please maintain respectful and professional communication.',
        sanitizedText: raw,
        hasMaskedContent: false,
        matchedSnippet: match[0],
      };
    }
  }

  // 1.8 Security & Prompt Injection
  for (const pattern of SECURITY_ATTACK_PATTERNS) {
    const match = raw.match(pattern);
    if (match) {
      return {
        isValid: false,
        status: 'block',
        level: 3,
        category: 'security_attack',
        reason: 'Security command injection or system manipulation detected.',
        sanitizedText: raw,
        hasMaskedContent: false,
        matchedSnippet: match[0],
      };
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 2: CHECK LEVEL 2 (CONTACT INFO AUTO-MASKING & WARNING)
  // ---------------------------------------------------------------------------
  let sanitized = raw;
  let hasMaskedContent = false;
  let matchedContactType = null;

  for (const item of CONTACT_INFO_PATTERNS) {
    if (item.regex.test(sanitized)) {
      hasMaskedContent = true;
      matchedContactType = item.label;
      sanitized = sanitized.replace(item.regex, '[Contact details hidden by WriteMyWords for safety]');
    }
  }

  if (hasMaskedContent) {
    return {
      isValid: true,
      status: 'warn_mask',
      level: 2,
      category: 'contact_info',
      reason: 'Please keep communication inside WriteMyWords. Sharing direct contact details is not allowed.',
      sanitizedText: sanitized,
      hasMaskedContent: true,
      matchedSnippet: matchedContactType,
    };
  }

  // ---------------------------------------------------------------------------
  // STEP 3: LEVEL 1 (ALLOW NORMAL CONVERSATION)
  // ---------------------------------------------------------------------------
  return {
    isValid: true,
    status: 'allow',
    level: 1,
    category: null,
    reason: null,
    sanitizedText: raw,
    hasMaskedContent: false,
    matchedSnippet: null,
  };
}

/**
 * Convenience helper to sanitize and mask sensitive text
 * @param {string} text 
 * @returns {string}
 */
export function sanitizeMessageText(text) {
  if (!text) return '';
  const result = validateMessageContent(text);
  return result.sanitizedText || text;
}

/**
 * Validates uploaded files to prevent malicious scripts or disallowed formats
 * @param {File} file 
 * @returns {{ isValid: boolean, reason: string | null }}
 */
export function validateUploadedFile(file) {
  if (!file) return { isValid: true, reason: null };

  const blockedExtensions = [
    '.exe', '.bat', '.cmd', '.sh', '.vbs', '.msi', '.com', '.scr', '.pif', '.jar', '.apk', '.bin', '.dll'
  ];
  
  const fileName = file.name.toLowerCase();
  for (const ext of blockedExtensions) {
    if (fileName.endsWith(ext)) {
      return {
        isValid: false,
        reason: `Executable and script file formats (${ext}) are blocked for security. Please upload Word documents (.docx, .doc), PDFs, presentations, images, or ZIP archives.`,
      };
    }
  }

  if (file.size > 25 * 1024 * 1024) {
    return {
      isValid: false,
      reason: 'File size exceeds the 25MB maximum limit. Please compress your file.',
    };
  }

  return { isValid: true, reason: null };
}
