package at.htl.boundary;

import at.htl.service.SinusService;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import io.quarkus.scheduler.Scheduled;

import org.eclipse.microprofile.reactive.messaging.Channel;
import org.eclipse.microprofile.reactive.messaging.Emitter;
import org.eclipse.microprofile.reactive.messaging.OnOverflow;

@ApplicationScoped
public class SinusResource {

    @Inject
    SinusService sinusService;

    @Inject
    @Channel("sine-out")
    @OnOverflow(OnOverflow.Strategy.DROP)
    Emitter<String> emitter;

    @Scheduled(every = "1s")
    void publish() {
        double value = sinusService.next().value();
        emitter.send(Double.toString(value));
    }
}
