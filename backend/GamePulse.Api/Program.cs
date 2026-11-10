using GamePulse.Api.Services;
using System.IO.Compression;
using Microsoft.AspNetCore.ResponseCompression;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.MimeTypes = ["application/json"];
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);

builder.Services.AddSingleton<NbaJsonDataService>();
builder.Services.AddSingleton<WnbaJsonDataService>();
builder.Services.AddSingleton<MlbJsonDataService>();
builder.Services.AddSingleton<NflDataService>();
builder.Services.AddSingleton<NhlDataService>();
builder.Services.AddSingleton<MlsDataService>();

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

// Public sports JSON only; no response caching or changes to freshness semantics.
app.UseWhen(context => HttpMethods.IsGet(context.Request.Method)
    && context.Request.Path.StartsWithSegments("/api/leagues")
    && !context.Request.Headers.ContainsKey("Authorization")
    && context.User.Identity?.IsAuthenticated != true,
    branch => branch.UseResponseCompression());

app.UseAuthorization();

app.MapControllers();

app.Run();
