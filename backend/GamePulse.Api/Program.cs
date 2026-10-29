using GamePulse.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddSingleton<NbaJsonDataService>();
builder.Services.AddSingleton<WnbaJsonDataService>();
builder.Services.AddSingleton<MlbJsonDataService>();
builder.Services.AddSingleton<NflDataService>();
builder.Services.AddSingleton<NhlDataService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowGamePulseFrontend", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:3000",
                "https://game-pulse-steel.vercel.app"
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowGamePulseFrontend");

app.UseAuthorization();

app.MapControllers();

app.Run();
