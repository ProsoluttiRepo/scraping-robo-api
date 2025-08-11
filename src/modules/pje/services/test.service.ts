import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

@Injectable()
export class TestService {
  async execute() {
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));

    try {
      // const response = await client.get(
      //   'https://pje.trt2.jus.br/pje-consulta-api/api/processos/dadosbasicos/1000778-81.2023.5.02.0707',
      //   {
      //     headers: {
      //       accept: 'application/json, text/plain, */*',
      //       'content-type': 'application/json',
      //       'x-grau-instancia': '1',
      //       'user-agent': 'Mozilla/5.0',
      //       referer:
      //         'https://pje.trt2.jus.br/consultaprocessual/detalhe-processo/1000778-81.2023.5.02.0707/1',
      //       // Você ainda pode enviar cookies manuais aqui, se quiser
      //       // cookie: '...',
      //       cookie:
      //         'MO=PJEOFFICE; tokenDesafio=4a07ef58e4da24fb6fc981e8b71f771b593001d91b03a3bccf3e7110f4946d2cc117ffd16628c920bd256229d8239ea11e97e587c01881d07af3aaab7c57c0ed0c832370e6a87627c0f16805cfa2d6d55106e1864e8a4e85e6922dafccb3d024; respostaDesafio= a6evks; access_token=eyJraWQiOiJJWDBETTdYYkN4ZGNIR0x1WE1kZW1XSnZYaFF1UmN3b0piZ3gwU3JnVHFRIiwiYWxnIjoiRVMyNTYifQ.eyJqdGkiOiJmMDQwYjRhMi1lYmI5LTRlOGItODA5ZS00MGQ3OTY5ZTA2OGEiLCJpc3MiOiJodHRwczovL3BqZS50cnQyLmp1cy5ici9wamUtc2VndXJhbmNhLyIsImlhdCI6MTc1NDQxMTgyMiwic3ViIjoiZTk5NzVhY2EtYTMxOS00N2VlLWE1MDYtZDk2Y2RkNTMyZTI2LnBqZSIsImV4cCI6MTc1NDQxNTQyMiwic2lnbGFTaXN0ZW1hIjoiUEpFIiwiaW5zdGFuY2lhIjoxLCJ0aXBvIjoiVVNVQVJJTyIsImlkIjo1Njg0ODM5LCJsb2dpbiI6IjQ0MTY0NDM2ODQwIiwibm9tZSI6IkFORFJFIExVSVogVkVMQVIgU0FOVE9TIiwicGVyZmlsIjo0NzA3MDUsInBhcGVsIjp7ImlkIjoxMDA1LCJub21lIjoiQWR2b2dhZG8iLCJpZGVudGlmaWNhZG9yIjoiQURWT0dBRE8ifSwicGFwZWxLeiI6eyJpZCI6MTAsIm5vbWUiOiJBZHZvZ2FkbyIsImlkZW50aWZpY2Fkb3IiOiJBRFZPR0FETyJ9LCJsb2NhbGl6YWNhbyI6eyJpZCI6MjkxNzMzLCJkZXNjcmljYW8iOiJBTkRSRSBMVUlaIFZFTEFSIFNBTlRPUyAoNDQxLjY0NC4zNjgtNDApIn0sIm1ldG9kb0F1dGVudGljYWNhbyI6IkNFUlRJRklDQURPIiwic2lkIjoiOTEyY2UyNTctYzNkNi00M2U5LThkMmUtYTFlMTI0NzJiMWM1Iiwib3JpZ2VtIjoiVFJUMiIsInVzdWFyaW9VbmlmaWNhZG8iOnRydWUsIm90cFBlcnNpc3RpZG8iOmZhbHNlfQ; sso_refresh_token=eyJhbGciOiJIUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICI4ZmViYjJiOS0zYmIzLTQzZmItYTMxMS0xMjJmMmNlODIwNGUifQ.eyJleHAiOjE3NTQ0NDA2MjIsImlhdCI6MTc1NDQxMTgyMiwianRpIjoiNDdhMzI2Y2EtZDJhZi00ZTA0LTlmYjktYjE0ODdjOTBjMWRiIiwiaXNzIjoiaHR0cHM6Ly9zc28uY2xvdWQucGplLmp1cy5ici9hdXRoL3JlYWxtcy9wamUiLCJhdWQiOiJodHRwczovL3Nzby5jbG91ZC5wamUuanVzLmJyL2F1dGgvcmVhbG1zL3BqZSIsInN1YiI6IjA3NmY5MDI1LTNkNmYtNDgwMS04Nzg4LTlhODIyMDIwNjcyMCIsInR5cCI6IlJlZnJlc2giLCJhenAiOiJwamUtdHJ0Mi0xZyIsInNlc3Npb25fc3RhdGUiOiIzZDcxNzliMy02ZWFhLTQ0MDAtYTAxMi1kZWJhNDk3ODM4ZDEiLCJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIiwic2lkIjoiM2Q3MTc5YjMtNmVhYS00NDAwLWEwMTItZGViYTQ5NzgzOGQxIn0.xDhyQP9n8SpZFmQlKtdfLTrw20puOxxCibgUpf9GChg; Xsrf-Token=77B557CA7DBF5989872B7A8E19CBB4EABAB05029B1FAB413A652615CC5B75C605A24E6ED375EB2B9853C3EC093EA6B655233; access_token_footer=seK7Q4K5lheGjod7vNvBT3S9UKL9jE3Pz05N4qhc7TiwuxRtaOiT3Z7IaoOPV_fU-RmEwJ-JWsYhyO3uQ_PjkA; refresh_token=eyJraWQiOiJJWDBETTdYYkN4ZGNIR0x1WE1kZW1XSnZYaFF1UmN3b0piZ3gwU3JnVHFRIiwiYWxnIjoiRVMyNTYifQ.eyJqdGkiOiJhNTU4MjgwYi03NDk3LTQ3MTEtOTgyZi03M2IyOTZjMWY4ZGEiLCJpc3MiOiJodHRwczovL3BqZS50cnQyLmp1cy5ici9wamUtc2VndXJhbmNhLyIsImlhdCI6MTc1NDQxMTgyMiwic3ViIjoiZTk5NzVhY2EtYTMxOS00N2VlLWE1MDYtZDk2Y2RkNTMyZTI2LnBqZSIsImV4cCI6MTc1NDQ1NTAyMiwic2lnbGFTaXN0ZW1hIjoiUEpFIiwiaW5zdGFuY2lhIjoxLCJ0aXBvIjoiUkVGUkVTSF9UT0tFTiIsImxvZ2luIjoiNDQxNjQ0MzY4NDAiLCJwZXJmaWwiOjQ3MDcwNSwic2lkIjoiOTEyY2UyNTctYzNkNi00M2U5LThkMmUtYTFlMTI0NzJiMWM1IiwibWV0b2RvQXV0ZW50aWNhY2FvIjoiQ0VSVElGSUNBRE8iLCJ1c3VhcmlvVW5pZmljYWRvIjp0cnVlLCJvcmlnZW0iOiJUUlQyIn0.hPWrI5ORRn_Ie_LwVHWGUTk4rDMlTxnt9HJ2R2Uqu3F0eArG9ye0RyhEbCvWXiWPh1VEtfSDRV-R9ZZeQDp1Dw; ASSINADOR_PJE=PJEOFFICE',
      //     },
      //   },
      // );

      const responseProcess = await client.get(
        'https://pje.trt2.jus.br/pje-consulta-api/api/processos/5317087?tokenDesafio=6ac461bdf230c860e7c4c38015495b77cb43cd597637a0bb6ed6dea3c6484f0d4f240819ddc4bf08fb5f4d998c3816db77d611319d87a72e28f53f87bd1f578acef3850c8ecdf0baf54f7090eb95be12216cec67fdfca6c657e60cacc41cd258&resposta=ssty2u',
        {
          headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json',
            'x-grau-instancia': '1',
            'user-agent': 'Mozilla/5.0',
            referer:
              'https://pje.trt2.jus.br/consultaprocessual/detalhe-processo/1000778-81.2023.5.02.0707/1',
            cookie:
              'MO=PJEOFFICE; tokenDesafio=6ac461bdf230c860e7c4c38015495b77cb43cd597637a0bb6ed6dea3c6484f0d4f240819ddc4bf08fb5f4d998c3816db77d611319d87a72e28f53f87bd1f578acef3850c8ecdf0baf54f7090eb95be12216cec67fdfca6c657e60cacc41cd258; respostaDesafio=ssty2u; access_token=eyJraWQiOiJJWDBETTdYYkN4ZGNIR0x1WE1kZW1XSnZYaFF1UmN3b0piZ3gwU3JnVHFRIiwiYWxnIjoiRVMyNTYifQ.eyJqdGkiOiJmMDQwYjRhMi1lYmI5LTRlOGItODA5ZS00MGQ3OTY5ZTA2OGEiLCJpc3MiOiJodHRwczovL3BqZS50cnQyLmp1cy5ici9wamUtc2VndXJhbmNhLyIsImlhdCI6MTc1NDQxMTgyMiwic3ViIjoiZTk5NzVhY2EtYTMxOS00N2VlLWE1MDYtZDk2Y2RkNTMyZTI2LnBqZSIsImV4cCI6MTc1NDQxNTQyMiwic2lnbGFTaXN0ZW1hIjoiUEpFIiwiaW5zdGFuY2lhIjoxLCJ0aXBvIjoiVVNVQVJJTyIsImlkIjo1Njg0ODM5LCJsb2dpbiI6IjQ0MTY0NDM2ODQwIiwibm9tZSI6IkFORFJFIExVSVogVkVMQVIgU0FOVE9TIiwicGVyZmlsIjo0NzA3MDUsInBhcGVsIjp7ImlkIjoxMDA1LCJub21lIjoiQWR2b2dhZG8iLCJpZGVudGlmaWNhZG9yIjoiQURWT0dBRE8ifSwicGFwZWxLeiI6eyJpZCI6MTAsIm5vbWUiOiJBZHZvZ2FkbyIsImlkZW50aWZpY2Fkb3IiOiJBRFZPR0FETyJ9LCJsb2NhbGl6YWNhbyI6eyJpZCI6MjkxNzMzLCJkZXNjcmljYW8iOiJBTkRSRSBMVUlaIFZFTEFSIFNBTlRPUyAoNDQxLjY0NC4zNjgtNDApIn0sIm1ldG9kb0F1dGVudGljYWNhbyI6IkNFUlRJRklDQURPIiwic2lkIjoiOTEyY2UyNTctYzNkNi00M2U5LThkMmUtYTFlMTI0NzJiMWM1Iiwib3JpZ2VtIjoiVFJUMiIsInVzdWFyaW9VbmlmaWNhZG8iOnRydWUsIm90cFBlcnNpc3RpZG8iOmZhbHNlfQ; sso_refresh_token=eyJhbGciOiJIUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICI4ZmViYjJiOS0zYmIzLTQzZmItYTMxMS0xMjJmMmNlODIwNGUifQ.eyJleHAiOjE3NTQ0NDA2MjIsImlhdCI6MTc1NDQxMTgyMiwianRpIjoiNDdhMzI2Y2EtZDJhZi00ZTA0LTlmYjktYjE0ODdjOTBjMWRiIiwiaXNzIjoiaHR0cHM6Ly9zc28uY2xvdWQucGplLmp1cy5ici9hdXRoL3JlYWxtcy9wamUiLCJhdWQiOiJodHRwczovL3Nzby5jbG91ZC5wamUuanVzLmJyL2F1dGgvcmVhbG1zL3BqZSIsInN1YiI6IjA3NmY5MDI1LTNkNmYtNDgwMS04Nzg4LTlhODIyMDIwNjcyMCIsInR5cCI6IlJlZnJlc2giLCJhenAiOiJwamUtdHJ0Mi0xZyIsInNlc3Npb25fc3RhdGUiOiIzZDcxNzliMy02ZWFhLTQ0MDAtYTAxMi1kZWJhNDk3ODM4ZDEiLCJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIiwic2lkIjoiM2Q3MTc5YjMtNmVhYS00NDAwLWEwMTItZGViYTQ5NzgzOGQxIn0.xDhyQP9n8SpZFmQlKtdfLTrw20puOxxCibgUpf9GChg; Xsrf-Token=77B557CA7DBF5989872B7A8E19CBB4EABAB05029B1FAB413A652615CC5B75C605A24E6ED375EB2B9853C3EC093EA6B655233; access_token_footer=seK7Q4K5lheGjod7vNvBT3S9UKL9jE3Pz05N4qhc7TiwuxRtaOiT3Z7IaoOPV_fU-RmEwJ-JWsYhyO3uQ_PjkA; refresh_token=eyJraWQiOiJJWDBETTdYYkN4ZGNIR0x1WE1kZW1XSnZYaFF1UmN3b0piZ3gwU3JnVHFRIiwiYWxnIjoiRVMyNTYifQ.eyJqdGkiOiJhNTU4MjgwYi03NDk3LTQ3MTEtOTgyZi03M2IyOTZjMWY4ZGEiLCJpc3MiOiJodHRwczovL3BqZS50cnQyLmp1cy5ici9wamUtc2VndXJhbmNhLyIsImlhdCI6MTc1NDQxMTgyMiwic3ViIjoiZTk5NzVhY2EtYTMxOS00N2VlLWE1MDYtZDk2Y2RkNTMyZTI2LnBqZSIsImV4cCI6MTc1NDQ1NTAyMiwic2lnbGFTaXN0ZW1hIjoiUEpFIiwiaW5zdGFuY2lhIjoxLCJ0aXBvIjoiUkVGUkVTSF9UT0tFTiIsImxvZ2luIjoiNDQxNjQ0MzY4NDAiLCJwZXJmaWwiOjQ3MDcwNSwic2lkIjoiOTEyY2UyNTctYzNkNi00M2U5LThkMmUtYTFlMTI0NzJiMWM1IiwibWV0b2RvQXV0ZW50aWNhY2FvIjoiQ0VSVElGSUNBRE8iLCJ1c3VhcmlvVW5pZmljYWRvIjp0cnVlLCJvcmlnZW0iOiJUUlQyIn0.hPWrI5ORRn_Ie_LwVHWGUTk4rDMlTxnt9HJ2R2Uqu3F0eArG9ye0RyhEbCvWXiWPh1VEtfSDRV-R9ZZeQDp1Dw; ASSINADOR_PJE=PJEOFFICE',
          },
        },
      );
      // 👇 Aqui estão os headers da resposta

      return responseProcess.data;
    } catch (error) {
      console.error('Erro ao buscar dados básicos:', error.message);
    }
  }
}
