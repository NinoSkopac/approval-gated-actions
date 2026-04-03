export interface GmailSelectors {
  readyIndicators: string[];
  subjectInput: string[];
  messageBody: string[];
  sendButton: string[];
  moreSendOptionsButton: string[];
  scheduleSendMenuItem: string[];
  customScheduleButton: string[];
  scheduleDateInput: string[];
  scheduleTimeInput: string[];
  scheduleConfirmButton: string[];
  toast: string[];
}

export const defaultGmailSelectors: GmailSelectors = {
  readyIndicators: ['div[gh="cm"]', '[role="button"][gh="cm"]'],
  subjectInput: ['input[name="subjectbox"]'],
  messageBody: [
    'div[aria-label="Message Body"]',
    'div[role="textbox"][aria-label="Message Body"]'
  ],
  sendButton: [
    'div[role="button"][data-tooltip^="Send"]',
    'div[role="button"][aria-label^="Send"]',
    'div[role="button"][aria-label="Send"]'
  ],
  moreSendOptionsButton: [
    'div[role="button"][aria-label="More send options"]',
    'div[role="button"][data-tooltip="More send options"]'
  ],
  scheduleSendMenuItem: ['text=Schedule send'],
  customScheduleButton: ['text=Pick date & time', 'text=Custom'],
  scheduleDateInput: ['input[aria-label="Date"]', 'input[type="date"]'],
  scheduleTimeInput: ['input[aria-label="Time"]', 'input[type="time"]'],
  scheduleConfirmButton: [
    'button:has-text("Schedule send")',
    'div[role="button"]:has-text("Schedule send")'
  ],
  toast: ['div[role="alert"]', '[aria-live="assertive"]']
};
