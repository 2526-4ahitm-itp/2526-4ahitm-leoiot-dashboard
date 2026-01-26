// at.htl.boundary.SinusResource.java
package at.htl.boundary;

import at.htl.service.SensorService;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import io.quarkus.scheduler.Scheduled;

import org.eclipse.microprofile.reactive.messaging.Channel;
import org.eclipse.microprofile.reactive.messaging.Emitter;
import org.eclipse.microprofile.reactive.messaging.OnOverflow;

@ApplicationScoped
public class SinusResource {

    @Inject
    SensorService sensorService;

    @Inject
    @Channel("sine-out")
    @OnOverflow(OnOverflow.Strategy.DROP)
    Emitter<String> emitter;

    @Scheduled(every = "1s")
    void publish() {
        double value = sensorService.readValue();
        emitter.send(Double.toString(value));
    }
}