"""Run with a local server on port 5173. pip install playwright; playwright install chromium."""
import os,json,pathlib,subprocess,time,atexit,io
from PIL import Image
from playwright.sync_api import sync_playwright,expect
root=pathlib.Path(__file__).resolve().parents[1]
def screenshot(page,name):
 target=root/'docs/screenshots';target.mkdir(parents=True,exist_ok=True)
 Image.open(io.BytesIO(page.screenshot(full_page=True))).save(target/(name+'.webp'),quality=60)
server=subprocess.Popen(['python','-m','http.server','5173','--bind','127.0.0.1','--directory',str(root)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
atexit.register(server.terminate)
time.sleep(.4)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH') or None,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 page=browser.new_page(viewport={'width':1600,'height':1000},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:5173');page.get_by_role('heading',name='Dashboard',exact=True).wait_for()
 screenshot(page,'dashboard')
 page.locator('nav button').filter(has_text='Patients').click()
 page.get_by_role('button',name='+ Add patient',exact=True).click();page.locator('[name=name]').fill('Test Patient');page.locator('[name=age]').fill('37');page.locator('dialog button[type=submit]').click()
 assert page.locator('#patient-select').input_value().startswith('PT-')
 page.locator('nav button').filter(has_text='Scan & Analyze').click();page.wait_for_function("document.querySelector('canvas')?.getContext('2d').getImageData(500,250,1,1).data[3]===255")
 page.locator('[data-action=add-finding]').click();page.locator('[name=note]').fill('Manual demo note');page.locator('dialog button[type=submit]').click();assert page.locator('tbody tr').count()==1
 before=page.locator('canvas').evaluate('(c)=>c.toDataURL()');page.locator('#image-mode').select_option('edges');page.wait_for_timeout(250);after=page.locator('canvas').evaluate('(c)=>c.toDataURL()');assert before!=after
 page.locator('[data-action=ruler]').click();page.wait_for_timeout(200);box=page.locator('canvas').bounding_box();page.mouse.click(box['x']+70,box['y']+70);page.mouse.click(box['x']+180,box['y']+100);assert 'Distance:' in page.locator('#measurement').inner_text()
 page.locator('[data-action=save-scan]').click()
 with page.expect_download() as d:page.locator('[data-action=annotations]').click()
 assert d.value.suggested_filename.endswith('.json')
 screenshot(page,'scan')
 page.locator('nav button').filter(has_text='Treatment Plans').click();page.locator('[data-tooth="26"]').click();page.locator('[data-action=add-plan]').click();page.locator('[name=treatment]').fill('Clinician review');page.locator('[name=date]').fill('2026-11-01');page.locator('dialog button[type=submit]').click();page.locator('[data-plan]').select_option('Scheduled');assert 'Scheduled' in page.locator('tbody').inner_text()
 page.reload()
 page.locator('nav button').filter(has_text='Treatment Plans').click();assert 'Clinician review' in page.locator('body').inner_text()
 screenshot(page,'treatment')
 page.locator('nav button').filter(has_text='Reports').click();page.locator('[data-action=generate-report]').click();assert page.locator('.timeline').count()>=2
 with page.expect_download() as d:page.locator('[data-action=csv]').click()
 assert d.value.suggested_filename.endswith('.csv')
 screenshot(page,'reports')
 page.locator('#patient-select').select_option('PT-0148');assert 'Manual demo note' not in page.locator('body').inner_text();assert 'Clinician review' not in page.locator('body').inner_text()
 page.locator('nav button').filter(has_text='Settings').click()
 with page.expect_download() as d:page.locator('[data-action=backup]').click()
 backup=d.value.path();page.locator('#data-upload').set_input_files(backup);expect(page.locator('#toast')).to_contain_text('restored')
 page.locator('#data-upload').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"version":999}'});expect(page.locator('#toast')).to_contain_text('rejected')
 page.locator('nav button').filter(has_text='AI Analysis').click();page.wait_for_timeout(400);page.locator('#image-upload').set_input_files(str(root/'docs/reference/screen-1.webp'));page.wait_for_timeout(400);assert 'Uploaded image' in page.locator('.viewer-caption').inner_text()
 screenshot(page,'analysis')
 page.set_viewport_size({'width':390,'height':844});page.locator('nav button').filter(has_text='Dashboard').click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 screenshot(page,'mobile')
 assert not errors,errors
 (root/'docs/browser-report.json').write_text(json.dumps({'passed':True,'checks':['navigation','patient creation','manual finding','pixel processing','ruler','scan metadata','annotation export','treatment creation/status/persistence','report generation','CSV export','patient isolation','backup restore','invalid backup rejection','image upload','mobile overflow'],'pageErrors':errors},indent=2))
 browser.close();print('Browser checks passed')
