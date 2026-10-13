package at.htl.boundary;

import at.htl.service.RoomTemperatureService;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import io.quarkus.logging.Log;
import io.quarkus.scheduler.Scheduled;

import org.eclipse.microprofile.reactive.messaging.Channel;
import org.eclipse.microprofile.reactive.messaging.Emitter;
import org.eclipse.microprofile.reactive.messaging.OnOverflow;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@ApplicationScoped
public class RoomTemperatureResource {

    @Inject
    RoomTemperatureService roomTemperatureService;

    @Inject
    ObjectMapper objectMapper;

    @Inject
    @Channel("room-temperature-out")
    @OnOverflow(value = OnOverflow.Strategy.BUFFER, bufferSize = 200)
    Emitter<String> emitter;

    @Scheduled(every = "10s", delay = 5, delayUnit = TimeUnit.SECONDS)
    void publish() {
        try {
            Map<String, Double> temps = roomTemperatureService.getAllRoomTemperatures();
            int count = 0;
            
            // Publish each room separately as simple JSON
            for (Map.Entry<String, Double> entry : temps.entrySet()) {
                String roomName = entry.getKey();
                Double temperature = entry.getValue();
                
                // Create JSON object with room and temperature
                Map<String, Object> roomData = new HashMap<>();
                roomData.put("room", roomName);
                roomData.put("temperature", temperature);
                
                String json = objectMapper.writeValueAsString(roomData);
                emitter.send(json);
                count++;
                
                // Add small delay every 10 messages to prevent overwhelming the buffer
                if (count % 10 == 0) {
                    try {
                        Thread.sleep(100); // 100ms delay every 10 messages
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
            
            Log.info("Published " + count + " room temperatures to MQTT");
        } catch (JsonProcessingException e) {
            Log.error("Failed to serialize room temperatures to JSON", e);
        }
    }
}
