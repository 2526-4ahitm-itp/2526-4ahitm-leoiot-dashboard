package at.htl.service;

import at.htl.model.SinusData;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SinusServiceTest {


    @Test
    void testSinusService() {
        SinusService service = new SinusService();

        SinusData d1 = service.next();
        SinusData d2 = service.next();
        SinusData d3 = service.next();

        assertEquals(0.0, d1.value(), 0.0001);
        assertEquals(Math.sin(Math.toRadians(10)), d2.value(), 0.0001);
        assertEquals(Math.sin(Math.toRadians(20)), d3.value(), 0.0001);


    }
}