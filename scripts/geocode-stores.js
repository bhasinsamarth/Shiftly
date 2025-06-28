// One-time Node.js script to geocode all stores in the database
// Run this with: node scripts/geocode-stores.js

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config();

// Configure Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

// Geocoding function using Nominatim API
async function getCoordinatesFromAddress(address) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                latitude: parseFloat(data[0].lat),
                longitude: parseFloat(data[0].lon)
            };
        }
        return null;
    } catch (error) {
        console.error('Error geocoding address:', error);
        return null;
    }
}

// Sleep function to respect API rate limits
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to build full address from store data
function buildStoreAddress(store) {
    const parts = [
        store.address_line_1,
        store.address_line_2,
        store.city,
        store.province,
        store.postal_code,
        store.country
    ].filter(part => part && part.trim());
    
    return parts.join(', ');
}

async function geocodeAllStores() {
    console.log('🚀 Starting bulk store geocoding...\n');

    try {
        // Fetch all stores
        const { data: stores, error } = await supabase
            .from('store')
            .select('store_id, store_name, address_line_1, address_line_2, city, province, postal_code, country, coordinates')
            .order('store_name');

        if (error) {
            throw error;
        }

        console.log(`📊 Found ${stores.length} stores in database`);

        // Filter stores that need geocoding
        const storesToGeocode = stores.filter(store => {
            if (!store.coordinates) return true;
            try {
                const coords = JSON.parse(store.coordinates);
                return !coords.latitude || !coords.longitude;
            } catch {
                return true;
            }
        });

        const storesWithoutAddress = storesToGeocode.filter(store => 
            !store.address_line_1 || store.address_line_1.trim() === ''
        );

        console.log(`✅ Stores with coordinates: ${stores.length - storesToGeocode.length}`);
        console.log(`❌ Stores without coordinates: ${storesToGeocode.length}`);
        console.log(`⚠️  Stores without address: ${storesWithoutAddress.length}\n`);

        if (storesToGeocode.length === 0) {
            console.log('🎉 All stores already have coordinates!');
            return;
        }

        console.log('🌍 Starting geocoding process...\n');

        let successCount = 0;
        let failureCount = 0;
        const results = [];

        for (let i = 0; i < storesToGeocode.length; i++) {
            const store = storesToGeocode[i];
            console.log(`[${i + 1}/${storesToGeocode.length}] Processing: ${store.store_name}`);

            const fullAddress = buildStoreAddress(store);
            if (!fullAddress) {
                console.log(`   ❌ Skipped - No address provided`);
                results.push({
                    ...store,
                    status: 'error',
                    error: 'No address provided'
                });
                failureCount++;
                continue;
            }

            try {
                // Respect Nominatim API rate limit (1 request per second)
                if (i > 0) {
                    console.log('   ⏳ Waiting 1.1 seconds (API rate limit)...');
                    await sleep(1100);
                }

                console.log(`   🔍 Geocoding: ${fullAddress}`);
                const coordinates = await getCoordinatesFromAddress(fullAddress);

                if (coordinates) {
                    // Update store in database with JSON coordinates
                    const coordinatesJson = JSON.stringify({
                        latitude: coordinates.latitude,
                        longitude: coordinates.longitude
                    });
                    
                    const { error: updateError } = await supabase
                        .from('store')
                        .update({
                            coordinates: coordinatesJson
                        })
                        .eq('store_id', store.store_id);

                    if (updateError) {
                        throw updateError;
                    }

                    console.log(`   ✅ Success: ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`);
                    results.push({
                        ...store,
                        status: 'success',
                        coordinates: coordinates
                    });
                    successCount++;
                } else {                console.log(`   ❌ Failed: Could not geocode address`);
                results.push({
                    ...store,
                    status: 'error',
                    error: 'Could not geocode address'
                });
                failureCount++;
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
            results.push({
                ...store,
                status: 'error',
                error: error.message
            });
            failureCount++;
        }

            console.log(''); // Empty line for readability
        }

        console.log('📈 GEOCODING SUMMARY');
        console.log('===================');
        console.log(`✅ Successful: ${successCount}`);
        console.log(`❌ Failed: ${failureCount}`);
        console.log(`📊 Total processed: ${storesToGeocode.length}`);

        if (failureCount > 0) {
            console.log('\n⚠️  FAILED STORES:');
            results.filter(r => r.status === 'error').forEach(store => {
                console.log(`   - ${store.store_name}: ${store.error}`);
            });
        }

        console.log('\n🎉 Geocoding process completed!');

        // Optionally save results to a file
        const fs = require('fs');
        const resultsJson = JSON.stringify(results, null, 2);
        fs.writeFileSync(`geocoding_results_${Date.now()}.json`, resultsJson);
        console.log('💾 Results saved to geocoding_results_[timestamp].json');

    } catch (error) {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    geocodeAllStores()
        .then(() => {
            console.log('\n👋 Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Script failed:', error);
            process.exit(1);
        });
}

module.exports = { geocodeAllStores, getCoordinatesFromAddress };
