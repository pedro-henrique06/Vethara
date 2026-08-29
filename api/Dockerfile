# Build multi-estagio: o SDK do .NET so existe aqui dentro. O VPS nao precisa
# ter dotnet instalado — e por isso que o deploy nao repete aquele publish +
# scp de centenas de DLLs.
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src
COPY Vethara.Api.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080
# Nao roda como root: se a API for comprometida, o estrago fica contido.
USER $APP_UID
ENTRYPOINT ["dotnet", "Vethara.Api.dll"]
