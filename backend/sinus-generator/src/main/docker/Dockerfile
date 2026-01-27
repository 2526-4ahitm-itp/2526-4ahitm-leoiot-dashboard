FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY . .
RUN mvn package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/quarkus-app/*.jar /app/
COPY --from=build /app/target/quarkus-app/lib/ /app/lib/
COPY --from=build /app/target/quarkus-app/quarkus/ /app/quarkus/
COPY --from=build /app/target/quarkus-app/app/ /app/app/

CMD ["java", "-jar", "/app/quarkus-run.jar"]