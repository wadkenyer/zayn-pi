// Shared singleton state — imported by all modules
const state = {
  currentUser:    null,
  accessToken:    null,   // Pi SDK access token — attached to all API requests
  currentGender:  'men',
  selectedSalon:  null,
  selectedService: null,
  selectedTime:   null,
  isOwner:        false,
  ownerSalonData: null,
  ownerServices:  [],
  salonAvailable: true,
  allSalons:      [],
};
// Returns JSON headers including the Pi auth token for API calls
export function apiHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(state.accessToken ? { 'Authorization': `Bearer ${state.accessToken}` } : {})
  };
}

export default state;
