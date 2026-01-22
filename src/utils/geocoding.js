import axios from 'axios';
import logger from './logger.js';

export const getAddressFromPincode = async (pincode) => {
  try {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      logger.warn('Google Maps API key not configured');
      return null;
    }

    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json`,
      {
        params: {
          address: `${pincode},India`,
          key: process.env.GOOGLE_MAPS_API_KEY
        },
        timeout: 5000
      }
    );

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const result = response.data.results[0];
      const addressComponents = result.address_components;

      let city, state;

      addressComponents.forEach(component => {
        if (component.types.includes('locality')) {
          city = component.long_name;
        }
        if (component.types.includes('administrative_area_level_1')) {
          state = component.long_name;
        }
      });

      return {
        city: city || '',
        state: state || '',
        coordinates: [
          result.geometry.location.lng,
          result.geometry.location.lat
        ],
        formattedAddress: result.formatted_address
      };
    }

    return null;
  } catch (error) {
    logger.error('Geocoding error:', error.message);
    return null;
  }
};

export const getCoordinatesFromAddress = async (address) => {
  try {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return null;
    }

    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json`,
      {
        params: {
          address: encodeURIComponent(address),
          key: process.env.GOOGLE_MAPS_API_KEY
        },
        timeout: 5000
      }
    );

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return [location.lng, location.lat];
    }

    return null;
  } catch (error) {
    logger.error('Geocoding error:', error.message);
    return null;
  }
};
