import os

from azure.monitor.opentelemetry import configure_azure_monitor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor


def setup_telemetry(app) -> None:
    """
    Enables Azure Application Insights instrumentation.

    Provides:
    - Request tracing
    - Dependency tracking
    - Exception reporting
    """

    conn_str = os.getenv("APPLICATIONINSIGHTS_CONNECTION_STRING")

    if not conn_str:
        print("⚠️ Telemetry disabled: APPLICATIONINSIGHTS_CONNECTION_STRING not set")
        return

    configure_azure_monitor(connection_string=conn_str)

    FastAPIInstrumentor.instrument_app(app)

    print("✅ Application Insights telemetry enabled")
