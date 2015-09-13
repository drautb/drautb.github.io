---
layout: post
title: LDS LCR API
tags:
- lds
- lcr
- api
- rest
---

If you're LDS, and you have any administrative responsibilities, you're at least mildly familiar with LCR. (Leader and Clerk Resources) This is the church's relatively new online administration system. It presents an online tool for managing membership records, home and visiting teaching, and member callings. 

As a member of one of the Elder's Quorum presidencies in our ward, I've had a really tough time figuring out a good way to keep an accurate email list of the members in our quorum. Sadly, LCR does not provide such a list in an easily consumable format. (I.e, no CSV to paste into your email client.) Additionally, with two Elder's quorums in our ward, LCR's opinion of which member is in which quorum is often incorrect, and thus cannot be trusted.

<!--more-->

After googling in the hopes that there would exist some sort of API for the new system, I came across someone else's project, [LCR.LDS.ORG][1], which appears to draw heavily from a blog post on [tech.lds.org][2]. ([Source][3])

I did some experimenting with `curl` to see what kind of information I could get access to and what it looked like. I was pretty pleased with what I found:

```bash
# Get my LDS account credentials.
source ~/.lds

# Login to get an auth token.
# The auth token comes back in the response as part of a `Set-Cookie` header.
# It has the form `ObSSOCookie=[TOKEN]` 
curl -vL -H "Content-Type: application/json" -X POST -d "username=$LDS_USER&password=$LDS_PASSWORD" https://signin.lds.org/login.html

# Using the token, I can get my personal member information like so:
curl -X GET -L -H "Cookie: ObSSOCookie=[REDACTED]" https://www.lds.org/htvt/services/v1/user/currentUser
```

My personal member information was formed like this: (In part)

```json
{
  "individualId": [REDACTED],
  "unitNumber": [REDACTED],
  "backgroundImage": null,
  "lastViewedGroup": null,
  "auxiliaries": [...]
  "admin": true,
  "multiAdmin": true,
  "parentUnitAdmin": false
}
```

Of particular interest is the `unitNumber` value. Using that value, and the token obtained above, I can retrieve a JSON object containing information for every household in our ward:

```bash
curl -X GET -L -H "Cookie: ObSSOCookie=[REDACTED]" https://www.lds.org/htvt/services/v1/[UNIT NUMBER]/members
```

Which comes back with this: (In part)

```json
{
  "families": [
  {
      "headOfHouse": {
        "formattedName": "Draut, Ben",
        "surname": "Draut",
        "priesthoodOffice": "ELDER",
        "email": "[REDACTED]",
      },
      "children": [...],
      "phone": "[REDACTED]",
      "address": {
        "streetAddress": "[REDACTED]",
        "city": "[REDACTED]",
        "state": "[REDACTED]",
        "postal": "[REDACTED]"
      },
      "emailAddress": "[REDACTED]",
    }
  ]
}
```

I was especially pleased to see that the email and address were easily obtained. This will make it pretty painless to write a simple tool that can _correctly_ generate a list of email addresses for the members of our quorum. Sweet!

[1]: https://hub.jazz.net/project/bakchoy/LDS%20LCR%20API/overview
[2]: http://tech.lds.org
[3]: http://tech.lds.org/wiki/External_Application_Development_with_SSO
