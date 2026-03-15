package at.htl.service;

import jakarta.enterprise.context.ApplicationScoped;

import java.util.HashMap;
import java.util.Map;

@ApplicationScoped
public class RoomTemperatureService {
    private final Map<String, Double> roomTemperatures = new HashMap<>();

    public RoomTemperatureService() {
        initializeRoomTemperatures();
    }

    private void initializeRoomTemperatures() {
        // Numeric rooms (Floors 1 & 2) - Normal temperature range: 20-23°C
        String[] numericRooms = {"1Aula", "103", "104", "105", "106", "107", "108", "109", "110", "111", "112", "113", "114", "115", "116", "117", "118", "119", "120", "121", "122", "123", "124", "125", "126", "127", "128", "129", "130", "131", "132", "133", "134", "135", "136", "137", "138", "139", "140", "141", "142", "143", "144", "145", "146", "147", "148", "149", "150", "151", "152", "153", "154", "213", "214", "253", "254"};

        // E-series rooms (Ground floor) - Warmer due to sun exposure: 22-25°C
        String[] eSeries = {"E05", "E07", "E08", "E09", "E10", "E11", "E22", "E23", "E24", "E25", "E26", "E59", "E71", "E72", "E73", "E581", "E582"};

        // U-series basement rooms - Cooler underground: 18-21°C
        String[] uSeries = {"U04", "U05", "U07", "U08", "U10", "UBiolab", "U71", "U72", "U73", "U74", "U74.1", "U77", "U78", "U79", "U81", "U82", "U83", "U84", "U85", "U86", "U87", "U88", "U89", "U90", "U91", "U92"};

        // Add numeric rooms with fixed temperatures (20-23°C range)
        for (String room : numericRooms) {
            roomTemperatures.put(room, calculateFixedTemperature(room, 20.0, 3.0));
        }

        // Add E-series rooms with fixed temperatures (22-25°C range)
        for (String room : eSeries) {
            roomTemperatures.put(room, calculateFixedTemperature(room, 22.0, 3.0));
        }

        // Add U-series rooms with fixed temperatures (18-21°C range)
        for (String room : uSeries) {
            roomTemperatures.put(room, calculateFixedTemperature(room, 18.0, 3.0));
        }
    }

    /**
     * Calculate a fixed temperature for a room based on its name hash.
     * Same room always gets the same temperature.
     *
     * @param roomId   The room identifier
     * @param baseTemp The minimum temperature for this room type
     * @param range    The temperature range (e.g., 3.0 means baseTemp to baseTemp+3.0)
     * @return A consistent temperature value for this room
     */
    private double calculateFixedTemperature(String roomId, double baseTemp, double range) {
        // Use hashCode to generate consistent value for same room
        int hash = Math.abs(roomId.hashCode());
        // Map hash to range [0.0, range] and add to base
        double offset = (hash % 1000) / 1000.0 * range;
        return Math.round((baseTemp + offset) * 10.0) / 10.0;  // Round to 1 decimal place
    }

    public Map<String, Double> getAllRoomTemperatures() {
        return new HashMap<>(roomTemperatures);
    }

    public Double getRoomTemperature(String roomId) {
        return roomTemperatures.get(roomId);
    }

    public void setRoomTemperature(String roomId, Double temperature) {
        if (temperature >= 12.0 && temperature <= 27.0) {
            roomTemperatures.put(roomId, temperature);
        }
    }
}
