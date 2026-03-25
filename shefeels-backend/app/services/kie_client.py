
import aiohttp
import asyncio
import logging
import json
from typing import Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class KieClient:
    """Client for interacting with Kie.ai API."""
    
    BASE_URL = "https://api.kie.ai/api/v1"
    
    def __init__(self):
        self.api_key = settings.KIE_API_KEY
        if not self.api_key:
            logger.warning("KIE_API_KEY is not set. Kie.ai client will not work.")
            
    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def create_task(self, 
                          model: str, 
                          input_data: Dict[str, Any], 
                          callback_url: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a new generation task.
        
        Args:
            model: The model name (e.g. "wan/2-5-image-to-video")
            input_data: The input parameters for the model
            callback_url: Optional URL for webhook callbacks
            
        Returns:
            The API response containing the taskId
        """
        url = f"{self.BASE_URL}/jobs/createTask"
        payload = {
            "model": model,
            "input": input_data
        }
        if callback_url:
            payload["callBackUrl"] = callback_url
            
        logger.info(f"Creating Kie.ai task with model: {model}")
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=self._get_headers(), json=payload) as response:
                if response.status != 200:
                    text = await response.text()
                    logger.error(f"Kie.ai create task failed: {response.status} - {text}")
                    raise Exception(f"Kie.ai API error: {response.status} - {text}")
                
                data = await response.json()
                if data.get("code") != 200:
                     raise Exception(f"Kie.ai API business error: {json.dumps(data)}")
                     
                return data

    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        Query task status by ID.
        
        Args:
            task_id: The ID of the task to query
            
        Returns:
            The task status data
        """
        url = f"{self.BASE_URL}/jobs/recordInfo?taskId={task_id}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=self._get_headers()) as response:
                if response.status != 200:
                    text = await response.text()
                    logger.error(f"Kie.ai get status failed: {response.status} - {text}")
                    raise Exception(f"Kie.ai API error: {response.status} - {text}")
                
                data = await response.json()
                if data.get("code") != 200:
                     raise Exception(f"Kie.ai API business error: {json.dumps(data)}")
                     
                return data

    async def wait_for_completion(self, 
                                  task_id: str, 
                                  poll_interval: int = 5, 
                                  timeout: int = 600) -> Dict[str, Any]:
        """
        Poll task status until completion or timeout.
        
        Args:
            task_id: Task ID
            poll_interval: Seconds between checks
            timeout: Maximum seconds to wait
            
        Returns:
            The completed task result
        """
        start_time = asyncio.get_event_loop().time()
        
        while (asyncio.get_event_loop().time() - start_time) < timeout:
            status_data = await self.get_task_status(task_id)
            task_data = status_data.get("data", {})
            state = task_data.get("state")
            
            if state == "success":
                return task_data
            elif state == "fail":
                fail_msg = task_data.get("failMsg", "Unknown failure")
                raise Exception(f"Task failed: {fail_msg}")
            
            # waiting, queuing, generating
            logger.debug(f"Task {task_id} state: {state}. Waiting {poll_interval}s...")
            await asyncio.sleep(poll_interval)
            
        raise TimeoutError(f"Task {task_id} timed out after {timeout} seconds")

kie_client = KieClient()
