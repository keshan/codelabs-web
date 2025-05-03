from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import sys
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

class CodeExecutionRequest(BaseModel):
    code: str

class CodeExecutionResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int

@app.post("/execute", response_model=CodeExecutionResponse)
async def execute_code(request: CodeExecutionRequest):
    logger.info(f"Received execution request.")
    # Limit execution time? Add resource constraints? Needs careful consideration for security.
    # Using python -c "code" for simplicity. Consider temp files for more complex scripts.
    python_executable = sys.executable # Use the same python running the server
    
    try:
        # WARNING: Running arbitrary code is inherently risky!
        # This basic implementation has minimal sandboxing.
        # Real-world applications need robust security (containers, restricted permissions, etc.)
        process = subprocess.run(
            [python_executable, "-c", request.code],
            capture_output=True,
            text=True,
            timeout=30  # Add a timeout (e.g., 30 seconds)
        )
        
        stdout = process.stdout
        stderr = process.stderr
        exit_code = process.returncode
        
        logger.info(f"Execution finished. Exit code: {exit_code}")
        # logger.debug(f"Stdout:\n{stdout}")
        # logger.debug(f"Stderr:\n{stderr}")
        
        return CodeExecutionResponse(stdout=stdout, stderr=stderr, exit_code=exit_code)

    except subprocess.TimeoutExpired:
        logger.warning("Execution timed out.")
        return CodeExecutionResponse(
            stdout="", 
            stderr="Execution timed out after 30 seconds.",
            exit_code=1 # Indicate timeout error
        )
    except Exception as e:
        logger.error(f"Error during code execution: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error during execution: {str(e)}")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    import os
    # Get port from environment variable (Cloud Run provides PORT)
    port = int(os.environ.get("PORT", 8080))
    logger.info(f"Starting server on port {port}")
    # Running directly for local testing. In Docker, uvicorn will be called.
    uvicorn.run(app, host="0.0.0.0", port=port)
