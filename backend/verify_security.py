import requests
import time
import sys

BASE_URL = "http://localhost:8001"

def check_security_headers():
    print("Checking security headers...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        headers = response.headers
        
        required_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
        }
        
        all_present = True
        for header, value in required_headers.items():
            if header not in headers:
                print(f"FAIL: Missing header {header}")
                all_present = False
            elif headers[header] != value:
                print(f"FAIL: Header {header} has value '{headers[header]}', expected '{value}'")
                all_present = False
            else:
                print(f"PASS: {header} is present and correct")
                
        return all_present
    except Exception as e:
        print(f"Error checking headers: {e}")
        return False

def check_rate_limiting():
    print("\nChecking rate limiting on /auth/login...")
    # Use a fake login to trigger rate limiting
    login_data = {"username": "test@example.com", "password": "password"}
    
    for i in range(1, 8):
        try:
            response = requests.post(f"{BASE_URL}/auth/login", data=login_data)
            print(f"Request {i}: Status Code {response.status_code}")
            
            if response.status_code == 429:
                print("PASS: Rate limiting triggered successfully")
                return True
        except Exception as e:
            print(f"Error sending request: {e}")
            
        time.sleep(0.1)
        
    print("FAIL: Rate limiting was not triggered after 7 requests")
    return False

if __name__ == "__main__":
    headers_ok = check_security_headers()
    rate_limit_ok = check_rate_limiting()
    
    if headers_ok and rate_limit_ok:
        print("\nALL SECURITY CHECKS PASSED")
        sys.exit(0)
    else:
        print("\nSOME SECURITY CHECKS FAILED")
        sys.exit(1)
