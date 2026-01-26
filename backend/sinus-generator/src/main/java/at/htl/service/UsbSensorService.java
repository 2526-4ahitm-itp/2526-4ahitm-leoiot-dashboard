import com.fazecast.jSerialComm.SerialPort;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class UsbSensorService {

    private SerialPort serialPort;

    public UsbSensorService() {
        SerialPort[] ports = SerialPort.getCommPorts();
        if (ports.length == 0) {
            throw new RuntimeException("Kein serieller Port gefunden!");
        }
        serialPort = ports[0];
        serialPort.setComPortParameters(9600, 8, 1, 0);
        serialPort.openPort();
    }

    public double readValue() {
        StringBuilder data = new StringBuilder();
        byte[] buffer = new byte[64];
        int numRead;
        while ((numRead = serialPort.readBytes(buffer, buffer.length)) > 0) {
            data.append(new String(buffer, 0, numRead));
            if (data.toString().contains("\n")) {
                break;
            }
        }
        try {
            String line = data.toString().trim();
            return Double.parseDouble(line);
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }
}