package at.htl.service;


import at.htl.model.SinusData;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class SinusService {
    private double angle = 0;

    public SinusData next() {
        double value = Math.sin(Math.toRadians(angle));
        SinusData data = new SinusData(
                System.currentTimeMillis(),
                angle,
                value
        );

        angle = (angle + 10) % 360;
        return data;
    }
}
