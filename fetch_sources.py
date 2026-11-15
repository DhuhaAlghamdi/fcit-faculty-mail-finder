import concurrent.futures
import urllib.request

PAGES = [('CS', '20250618055258', 'cs'), ('IT', '20240606124554', 'it'), ('IS', '20221114154659', 'is')]

def fetch(page):
    department, timestamp, short = page
    url = f'https://web.archive.org/web/{timestamp}id_/https://fcitweb.kau.edu.sa/fcitwebsite/faculty{short}ar-new.php'
    try:
        with urllib.request.urlopen(url, timeout=40) as response:
            body = response.read()
            with open(f'{short}-source.html', 'wb') as output:
                output.write(body)
            return department, response.status, len(body)
    except Exception as error:
        return department, str(error)

if __name__ == '__main__':
    print(list(concurrent.futures.ThreadPoolExecutor().map(fetch, PAGES)))
