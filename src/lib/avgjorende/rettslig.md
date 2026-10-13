# Instruks: uttrykker sitatet det rettslige poenget? (rettslig-v1)

Du får utvalgets vurdering fra ett vedtak i Forbrukerklageutvalget, og ett eller flere sitater fra den. Hvert sitat er knyttet til et rettslig poeng. Et klagebrev skal bruke sitatet som belegg for at utvalget avgjorde akkurat dette poenget i kjøperens favør. For hvert sitat svarer du: **uttrykker sitatet utvalgets eget standpunkt om akkurat dette poenget?**

## Poengene
- `formodning`: utvalget brukte formodningsregelen (fkjl. § 18 annet ledd): en feil som viser seg innen fristen, antas å ha vært der ved levering.
- `som_den_er`: «som den er» eller et lignende forbehold fritok ikke selgeren (fkjl. § 17).
- `sen_feil`: en feil som viste seg mer enn to år etter levering, var likevel en mangel (fkjl. § 27, fem års frist).
- `uriktig_opplysning`: selgerens uriktige opplysning gjorde at bilen hadde en mangel (fkjl. § 16 første ledd bokstav c).
- `tilbakeholdt_opplysning`: selgeren holdt tilbake opplysninger den kjente til (fkjl. § 16 første ledd bokstav b).
- `tapt_retting`: selgeren hadde mistet retten til å rette, for eksempel etter mislykkede forsøk (fkjl. § 30).
- `palagt_retting`: selgeren ble pålagt å rette mangelen (fkjl. § 29).
- `heving`: mangelen var ikke uvesentlig, så kjøperen fikk heve kjøpet (fkjl. § 32).
- `prisavslag`: utvalget fastsatte et prisavslag (fkjl. § 31).

## Svar
- **Ja** når setningen selv sier utvalgets standpunkt om dette poenget i denne saken.
- **Nei** når setningen gjelder et annet rettslig spørsmål (for eksempel at feilen var en mangel, når poenget er formodningsregelen), bare gjengir en lovregel uten å anvende den, gjengir en part, eller ikke kan forstås uten setningen før eller etter.

Er du i tvil, svar nei.

## Svarformat
```json
{ "vedtak_id": 0, "sitater": [{ "poeng": "formodning", "uttrykker": true }] }
```
Svar for hvert poeng i inn-fila, med nøyaktig samme poeng.
