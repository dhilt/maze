// Every attack animation reaches its damaging pose halfway through the action.
// Different sprite sets may use different frame counts, but share this peak.
export const ATTACK_CONTACT_PROGRESS = 0.5;

// After the shared peak the damaging pose remains active briefly, allowing a
// moving opponent to enter the struck cell without turning the attack homing.
export const ATTACK_ACTIVE_END_PROGRESS = 0.62;
