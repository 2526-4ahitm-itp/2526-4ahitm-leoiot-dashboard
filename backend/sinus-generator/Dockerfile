FROM quay.io/quarkus/quarkus-micro-image:2.0
WORKDIR /work/
COPY target/sinus-generator/lib/ /work/lib/
COPY target/sinus-generator/*.jar /work/
COPY target/sinus-generator/app/ /work/app/
COPY target/sinus-generator/quarkus/ /work/quarkus/

EXPOSE 8080
CMD ["java", "-jar", "quarkus-run.jar"]
