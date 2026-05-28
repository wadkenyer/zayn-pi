// Shared singleton state — imported by all modules
const state = {
  currentUser:    null,
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
export default state;
